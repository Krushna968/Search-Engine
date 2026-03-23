function startVoiceSearch() {
    const micBtn = document.getElementById('mic-btn');
    const searchBar = document.getElementById('search-bar');
    const voiceLang = document.getElementById('voice-lang') ? document.getElementById('voice-lang').value : 'en-US';

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Your browser does not support voice search. Please use a modern browser like Chrome.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = voiceLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.classList.add('text-primary', 'animate-pulse');
    micBtn.querySelector('span').innerText = 'hearing';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        searchBar.value = transcript;
        micBtn.classList.remove('text-primary', 'animate-pulse');
        micBtn.querySelector('span').innerText = 'mic';
        
        // Auto submit
        document.getElementById('search-form').submit();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        micBtn.classList.remove('text-primary', 'animate-pulse');
        micBtn.querySelector('span').innerText = 'mic';
        alert('Voice recognition failed: ' + event.error);
    };

    recognition.onend = () => {
        micBtn.classList.remove('text-primary', 'animate-pulse');
        micBtn.querySelector('span').innerText = 'mic';
    };

    recognition.start();
}
