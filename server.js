import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import path from "path";
import axios from "axios";
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { OAuth2Client } from 'google-auth-library';
dotenv.config();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exploreLocal')
    .then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Update User Schema to include Google ID
// Update User Schema to include streak information
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: function() {
            // Password is required only if the user doesn't use Google auth
            return !this.googleId;
        }
    },
    googleId: {
        type: String,
        sparse: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // Add streak tracking fields
    lastLogin: {
        type: Date,
        default: Date.now
    },
    currentStreak: {
        type: Number,
        default: 1
    },
    totalLogins: {
        type: Number,
        default: 1
    },
    userTypes: {
        type: Map,
        of: Number,
        default: {
            adventurous: 0,
            leisure: 0,
            cultural: 0,
            sightseeing: 0,
            nature: 0,
            foodie: 0,
            spiritual: 0,
            shopping: 0,
            family: 0,
            business: 0
        }
    }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

const User = mongoose.model('User', userSchema);

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './FrontEnd/Static')));
app.use('/js', express.static(path.join(__dirname, './FrontEnd/Static/js')));
// Add this new line
app.use('/image', express.static(path.join(__dirname, './FrontEnd/Static/image')));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/exploreLocal',
        ttl: 24 * 60 * 60,
        autoRemove: 'native'
    }),
    cookie: {
        secure: false,  // Set to false for HTTP
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const API_KEY = process.env.NEWS_API_KEY;

// Modified authentication middleware to be optional
const checkAuth = (req, res, next) => {
    if (req.session.userId) {
        req.isAuthenticated = true;
    } else if (req.session.isGuest) {
        req.isAuthenticated = true;
        req.isGuest = true;
    } else {
        req.isAuthenticated = false;
    }
    next();
};

// Add a new middleware to require authentication
// Make sure this middleware is defined before using it
const requireAuth = (req, res, next) => {
    if (req.session.userId || req.session.isGuest) {
        next();
    } else {
        // Redirect to login page if not authenticated
        res.redirect('/login');
    }
};

// Authentication Routes (unchanged)
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        const user = new User({ username, email, password });
        await user.save();
        req.session.userId = user._id;
        res.json({ message: 'Registration successful', redirect: '/main' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Function to update user streak
const updateUserStreak = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;
        
        const now = new Date();
        const lastLogin = new Date(user.lastLogin);
        
        // Calculate hours since last login
        const hoursSinceLastLogin = (now - lastLogin) / (1000 * 60 * 60);
        
        // Increment total logins
        user.totalLogins += 1;
        
        // Update streak based on time since last login
        if (hoursSinceLastLogin >= 24 && hoursSinceLastLogin < 48) {
            // If login is between 24-48 hours, increment streak
            user.currentStreak += 1;
        } else if (hoursSinceLastLogin >= 48) {
            // If more than 48 hours, reset streak
            user.currentStreak = 1;
        }
        // If less than 24 hours, don't change streak (already logged in today)
        
        // Update last login time
        user.lastLogin = now;
        
        await user.save();
        return user;
    } catch (error) {
        console.error('Error updating streak:', error);
    }
};

// Modify login routes to update streak
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Set session
        req.session.userId = user._id;
        
        // Update streak
        await updateUserStreak(user._id);
        
        res.json({ message: 'Login successful', redirect: '/main' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logout successful', redirect: '/' });
    });
});

// Add this route to your Express server code (after other authentication routes)
app.get('/api/guest-login', (req, res) => {
    // Create a guest session without requiring authentication
    req.session.isGuest = true;
    // You might want to generate a temporary guest ID
    req.session.guestId = 'guest_' + Date.now();
    
    res.json({ 
        message: 'Guest login successful', 
        redirect: '/main'  // Redirect to main page
    });
});

// Modified page routes to use checkAuth instead of requireAuth
app.get('/', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '/FrontEnd/Templates/landing.html'));
});

app.get('/login', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/login.html'));
});

app.get('/about', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/about.html'));
});

// Routes that require authentication - use requireAuth middleware
app.get('/main', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/main.html'));
});

app.get('/profile', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/profile.html'));
});

app.get('/map', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/map.html'));
});

app.get('/maps', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/maps.html'));
});

app.get('/planning', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/planning.html'));
});

// Routes that can benefit from authentication but don't require it
app.get('/currency', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/currency.html'));
});

app.get('/translate', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/translate.html'));
});

app.get('/category/:category', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/category-places.html'));
});

app.get('/similar', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/similar-places.html'));
});

app.get('/weather', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/weather.html'));
});

app.get('/news', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './FrontEnd/Templates/news.html'));
});

// Modified news API route to use checkAuth
app.get('/api/news/:category', checkAuth, async (req, res) => {
    const categoryQueries = {
        karnataka: 'Karnataka OR Bengaluru OR Mysuru news',
        india: 'India news -Karnataka',
        international: 'world news -India',
        sports: 'India sports cricket',
        tourism: 'India tourism travel'
    };

    const { category } = req.params;
    
    if (!categoryQueries[category]) {
        return res.status(400).json({ error: 'Invalid category' });
    }

    try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
            params: {
                apiKey: API_KEY,
                q: categoryQueries[category],
                language: 'en',
                sortBy: 'publishedAt',
                pageSize: 12
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('News API Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to fetch news',
            details: error.response?.data || error.message
        });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Update the port to 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

export default app;

// Add this route handler
// Move the API endpoint before the 404 catch-all middleware
app.post('/api/generate-itinerary', async (req, res) => {
    try {
        const { destination, days, activities } = req.body;
        const itinerary = {
            days: Array.from({ length: parseInt(days) }, (_, i) => ({
                activities: [
                    {
                        time: '09:00 AM',
                        name: 'Morning Activity',
                        description: `Explore ${destination}'s local attractions`
                    },
                    {
                        time: '12:00 PM',
                        name: 'Lunch Break',
                        description: 'Experience local cuisine'
                    },
                    {
                        time: '02:00 PM',
                        name: 'Afternoon Activity',
                        description: activities[0] || 'Sightseeing'
                    },
                    {
                        time: '07:00 PM',
                        name: 'Evening Activity',
                        description: 'Dinner and local entertainment'
                    }
                ]
            }))
        };

        res.json(itinerary);
    } catch (error) {
        console.error('Error generating itinerary:', error);
        res.status(500).json({ error: 'Failed to generate itinerary' });
    }
});

// Add API endpoint to get user profile information
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        // Get user ID from session
        const userId = req.session.userId;
        
        // If it's a guest user, return limited information
        if (req.session.isGuest) {
            return res.json({
                isGuest: true,
                username: 'Guest User',
                email: 'guest@example.com',
                createdAt: new Date(),
                currentStreak: 1,
                totalLogins: 1,
                lastLogin: new Date()
            });
        }
        
        // Find user in database
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Return user information (excluding sensitive data like password)
        res.json({
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            isGoogleUser: !!user.googleId,
            currentStreak: user.currentStreak || 1,
            totalLogins: user.totalLogins || 1,
            lastLogin: user.lastLogin || user.createdAt
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Add Google authentication endpoint
app.post('/api/google-auth', async (req, res) => {
    try {
        const { token } = req.body;
        
        // Verify the Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        // Get user info from the token
        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;
        
        // Check if user exists
        let user = await User.findOne({ googleId });
        
        if (!user) {
            // Check if email exists but not linked to Google
            user = await User.findOne({ email });
            
            if (user) {
                // Link existing account with Google
                user.googleId = googleId;
                await user.save();
            } else {
                // Create new user with Google credentials
                // Generate a username from email (before the @ symbol)
                const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);
                
                user = new User({
                    username,
                    email,
                    googleId,
                    // No password needed for Google auth
                });
                
                await user.save();
            }
        }
        
        // Set session
        req.session.userId = user._id;
        
        res.json({ 
            success: true, 
            message: 'Google authentication successful', 
            redirect: '/main'
        });
        
    } catch (error) {
        console.error('Google authentication error:', error);
        res.status(401).json({ 
            success: false,
            error: 'Google authentication failed' 
        });
    }
});
// Add this route to redirect users to Google's OAuth page
app.get('/api/google-auth/redirect', (req, res) => {
    const redirectUrl = `${req.protocol}://${req.get('host')}/api/google-auth/callback`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&scope=email%20profile&prompt=select_account`;
    
    res.redirect(googleAuthUrl);
});

// Improve the callback handler
app.get('/api/google-auth/callback', async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
        return res.redirect('/login?error=Google authentication failed');
    }
    
    try {
        const redirectUrl = `${req.protocol}://${req.get('host')}/api/google-auth/callback`;
        
        // Exchange the authorization code for tokens
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUrl,
            grant_type: 'authorization_code'
        });
        
        const { id_token, access_token } = tokenResponse.data;
        
        // Verify the ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        const email = payload.email;
        const name = payload.name || email.split('@')[0];
        
        // Check if user exists
        let user = await User.findOne({ googleId });
        
        if (!user) {
            // Create new user if not exists
            user = new User({
                username: name,
                email,
                googleId
            });
            await user.save();
        }
        
        // Set session
        req.session.userId = user._id;
        
        // Redirect to main page
        res.redirect('/main');
    } catch (error) {
        console.error('Google auth callback error:', error);
        console.error('Error details:', error.response?.data || error.message);
        res.redirect('/login?error=Google authentication failed');
    }
});

// Add the Gemini API endpoint for similar places
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const UNSPLASH_API_KEY = process.env.UNSPLASH_API_KEY; // Make sure this is in your .env file

// After the Gemini API endpoint
app.post('/api/get_similar_places/:place', async (req, res) => {
  const { place } = req.params;

  // Function to fetch image from Unsplash
  const getImageFromUnsplash = async (query) => {
    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: query + '${place}',
          per_page: 1,
          orientation: 'landscape'
        },
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
        }
      });
      
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0].urls.regular;
      }
      return null;
    } catch (error) {
      console.error(`Unsplash API error for ${query}:`, error.message);
      return null;
    }
  };

  const prompt = `
    Analyze ${place} and provide:
    1. A detailed description focusing on its unique characteristics
    2. Classification into these types (choose up to 3): 
    adventurous, leisure, cultural, sightseeing, nature, foodie, spiritual, shopping, family, business
    3. 5 similar destinations with their key features

    Format response as:
    Place Description: [brief-description]
    User Type: [classified-type]
    
    ---
    
    [
      {
        "name": "Destination Name",
        "description": "Short description",
        "things_to_do": ["Activity 1", "Activity 2", "Activity 3"]
      }
    ]
  `;

  try {
    // Get main place image in parallel with Gemini API call
    const mainPlaceImagePromise = getImageFromUnsplash(place);
    
    const geminiResponse = await axios.post(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const textOutput = geminiResponse.data.candidates[0].content.parts[0].text;
    
    // Split and parse response
    const [metadataSection, jsonSection] = textOutput.split('---');
    
    // Parse JSON destinations
    let destinations;
    try {
      destinations = JSON.parse(jsonSection);
    } catch (err) {
      const match = jsonSection.match(/\[.*\]/s);
      destinations = match ? JSON.parse(match[0]) : [];
    }

    // Extract place description and user type
    const descMatch = metadataSection.match(/Place Description:\s*(.+)/);
    const typeMatch = metadataSection.match(/User Type:\s*(.+)/);
    
    // Get main place image
    const mainPlaceImage = await mainPlaceImagePromise;
    
    // Get images for all destinations in parallel
    const imagePromises = destinations.map(dest => getImageFromUnsplash(dest.name));
    const destinationImages = await Promise.all(imagePromises);
    
    // Add images to destinations
    destinations = destinations.map((dest, index) => ({
      ...dest,
      image_url: destinationImages[index] || 'https://via.placeholder.com/400x300?text=No+Image+Available'
    }));
    
    // Add user type tracking
    if (req.session.userId && !req.session.isGuest) {
      try {
        const types = typeMatch ? typeMatch[1].split(', ') : [];
        await User.findByIdAndUpdate(req.session.userId, {
          $inc: types.reduce((acc, type) => {
            acc[`userTypes.${type.toLowerCase()}`] = 1;
            return acc;
          }, {})
        });
      } catch (error) {
        console.error('User type tracking error:', error);
      }
    }

    return res.json({ 
      place_description: descMatch ? descMatch[1] : `${place} is a popular destination`,
      user_type: typeMatch ? typeMatch[1] : 'unknown',
      place_image: mainPlaceImage || 'https://via.placeholder.com/400x300?text=No+Image+Available',
      similar_places: destinations 
    });

  } catch (err) {
    console.error('API Error:', err.response?.data || err.message);
    return res.status(500).json({ 
      error: 'Failed to get response from API',
      details: err.response?.data || err.message
    });
  }
});

app.get('/api/user/tagline', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Get top user type
        const types = Array.from(user.userTypes.entries());
        const [maxType] = types.reduce(([maxName, maxVal], [name, val]) => 
            val > maxVal ? [name, val] : [maxName, maxVal], ['', -1]);

        // Gemini prompt for tagline
        // In the /api/user/tagline endpoint, modify the prompt:
        const prompt = `Generate a creative, personality-driven tagline (12-15 words) for a me who specializes in ${maxType} experiences. Use 2-3 relevant emojis and follow these examples:
        - "Nature's true companion 🌿 | Trailblazer finding serenity in every mountain path 🏔️"
        - "Culinary cartographer 🗺️ | Mapping the world through its flavors and food traditions 🍜"
        - "Thrill-seeker with a map 🧭 | Converting adrenaline spikes into lifelong memories ⚡"
        Focus on unique perspectives rather than generic phrases. Keep the same prompt but do not interact with me. Just give me the tagline as a response. I want the response to contain only the Tagline`;
        
        const response = await axios.post(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });

// After getting the response, process it to ensure proper capitalization
const rawTagline = response.data.candidates[0].content.parts[0].text.replace(/"/g, '').trim();
const tagline = rawTagline.charAt(0).toUpperCase() + rawTagline.slice(1).toLowerCase();
        
        res.json({ 
            maxType,
            tagline,
            typeCounts: Object.fromEntries(Array.from(user.userTypes.entries()))
        });
    } catch (error) {
        console.error('Tagline generation error:', error);
        res.status(500).json({ error: 'Failed to generate tagline' });
    }
});

// Add a new route for category-based similar places
// Add a new API endpoint for Indian category places
app.post('/api/get_indian_places/:category', async (req, res) => {
  const { category } = req.params;
  
  // Make sure we're properly accessing the API key from environment variables
  const UNSPLASH_API_KEY = process.env.UNSPLASH_API_KEY;
  
  // Function to fetch image from Unsplash with better error handling
  const getImageFromUnsplash = async (query) => {
    try {
      console.log(`Fetching Unsplash image for: "${query} India"`);
      
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: `${query} India`,
          per_page: 1,
          orientation: 'landscape'
        },
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
        }
      });
      
      if (response.data.results && response.data.results.length > 0) {
        console.log(`Successfully retrieved image for "${query} India"`);
        return response.data.results[0].urls.regular;
      }
      
      console.log(`No results found for "${query} India"`);
      return null;
    } catch (error) {
      console.error(`Unsplash API error for "${query} India":`, error.response?.status, error.response?.statusText);
      console.error('Error details:', error.response?.data || error.message);
      return null;
    }
  };

  const prompt = `
    Analyze ${category} in India and provide:
    1. A detailed description of this category in India, focusing on its unique characteristics in 50 words
    2. 6 famous ${category} places in India with their key features
    
    Format response as:
    Place Description: [brief-description]
    
    ---
    
    [
      {
        "name": "Place Name, Location",
        "description": "Short description",
        "things_to_do": ["Activity 1", "Activity 2", "Activity 3", "Activity 4", "Activity 5"]
      }
    ]
  `;

  try {
    // Get main category image in parallel with Gemini API call
    const mainCategoryImagePromise = getImageFromUnsplash(category);
    
    const geminiResponse = await axios.post(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const textOutput = geminiResponse.data.candidates[0].content.parts[0].text;
    
    // Split and parse response
    const [metadataSection, jsonSection] = textOutput.split('---');
    
    // Parse JSON places
    let places;
    try {
      places = JSON.parse(jsonSection.trim());
    } catch (err) {
      const match = jsonSection.match(/\[.*\]/s);
      places = match ? JSON.parse(match[0]) : [];
    }

    // Extract place description
    const descMatch = metadataSection.match(/Place Description:\s*(.+)/s);
    const description = descMatch ? descMatch[1].trim() : `${category} in India are popular destinations`;
    
    // Get main category image
    const mainCategoryImage = await mainCategoryImagePromise;
    
    // Get images for all places in parallel
    console.log('Fetching images for places...');
    const imagePromises = places.map(place => getImageFromUnsplash(place.name));
    const placeImages = await Promise.all(imagePromises);
    
    // Add images to places
    places = places.map((place, index) => ({
      ...place,
      image_url: placeImages[index] || `https://source.unsplash.com/featured/?${encodeURIComponent(place.name)},india`
    }));

    return res.json({ 
      place_description: description,
      user_type: "Indian Tourism",
      place_image: mainCategoryImage || `https://source.unsplash.com/featured/?${encodeURIComponent(category)},india`,
      similar_places: places
    });
    
  } catch (error) {
    console.error('Error generating Indian places:', error);
    return res.status(500).json({ error: 'Failed to generate Indian places', details: error.message });
  }
});
