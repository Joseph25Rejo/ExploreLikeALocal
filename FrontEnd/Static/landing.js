document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons
    lucide.createIcons();

    // Parallax effect for the hero section
    let text = document.getElementById('text');
    let leaf = document.getElementById('leaf');
    let hill1 = document.getElementById('hill1');
    let hill4 = document.getElementById('hill4');
    let hill5 = document.getElementById('hill5');
    let parallaxSection = document.querySelector('.parallax');

    window.addEventListener('scroll', () => {
        let value = window.scrollY;
        let parallaxHeight = parallaxSection.offsetHeight;
        
        if (value <= parallaxHeight) {
            text.style.marginTop = value * 2.5 + 'px';
            leaf.style.top = value * -1.5 + 'px';
            leaf.style.left = value * 1.5 + 'px';
            hill5.style.left = value * 1.5 + 'px';
            hill4.style.left = value * -1.5 + 'px';
            hill1.style.top = value * 1 + 'px';
        }
    });

    // GSAP animations for feature pairs with horizontal scroll and pinning
    const featurePairs = gsap.utils.toArray('.feature-pair');
    const featuresSection = document.querySelector('.features-section');
    const featuresContainer = document.querySelector('.features-container');
    
    // Set initial state for all features
    gsap.set(featurePairs, { 
        opacity: 0,
        x: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%'
    });
    
    // Make first feature visible
    gsap.set(featurePairs[0], { 
        opacity: 1,
        x: 0,
        position: 'relative'
    });
    
    // Create a timeline for feature transitions
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: featuresSection,
            start: "top top",
            end: `+=${featurePairs.length * 100}%`,
            pin: true,
            anticipatePin: 1,
            scrub: 1,
            pinSpacing: true
        }
    });
    
    // Add animations to the timeline
    featurePairs.forEach((pair, index) => {
        if (index === 0) return; // Skip first one
        
        // Add animation to move previous pair out to the left
        tl.to(featurePairs[index-1], {
            opacity: 0,
            x: '-100%',
            duration: 0.5,
            ease: "power2.inOut"
        }, `feature${index}`);
        
        // Add animation to bring current pair in from the right
        tl.to(pair, {
            opacity: 1,
            x: 0,
            duration: 0.5,
            ease: "power2.out"
        }, `feature${index}`);
    });
});