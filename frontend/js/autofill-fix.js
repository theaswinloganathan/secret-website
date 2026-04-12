// Global autofill fix for floating labels
document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('.input-group input');

    function checkValue(input) {
        if (input.value && input.value.trim() !== '') {
            input.classList.add('has-val');
        } else {
            input.classList.remove('has-val');
        }
    }

    inputs.forEach(input => {
        // Initial check for aggressive autofills
        setTimeout(() => checkValue(input), 150);

        // Standard input tracking
        input.addEventListener('input', () => checkValue(input));
        input.addEventListener('change', () => checkValue(input));
        
        // Advanced animation tracking for WebKit stealth autofills that bypass 'input' event
        input.addEventListener('animationstart', (e) => {
            if (e.animationName === 'onAutoFillStart') {
                input.classList.add('has-val');
            }
        });
    });
});
