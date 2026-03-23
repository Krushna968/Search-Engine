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
    recognition.interimResults = true; // Enables capturing voice and writing instantly
    recognition.maxAlternatives = 1;

    micBtn.classList.add('text-primary', 'animate-pulse');
    micBtn.querySelector('span').innerText = 'hearing';

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // Show whatever is available, preferring final transcript along with any ongoing interim
        searchBar.value = finalTranscript + interimTranscript;
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
        
        // Auto submit if there is text in the search bar when the mic stops
        if (searchBar.value.trim() !== '') {
            document.getElementById('search-form').submit();
        }
    };

    recognition.start();
}
