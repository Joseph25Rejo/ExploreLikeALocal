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

    // Simple feature list display
    const featurePairs = document.querySelectorAll('.feature-pair');
    
    // Make all features visible in a list format
    featurePairs.forEach((pair, index) => {
        // Remove any absolute positioning
        pair.style.position = 'relative';
        pair.style.opacity = '1';
        pair.style.transform = 'none';
        
        // Add some spacing between features
        pair.style.marginBottom = '80px';
        
        // Add a simple fade-in effect when scrolling
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        observer.observe(pair);
    });
});