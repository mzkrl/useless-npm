export function getTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibe Check - Code Roast</title>
    <link href="https://fonts.googleapis.com/css?family=Press+Start+2P" rel="stylesheet">
    <link href="https://unpkg.com/nes.css@2.3.0/css/nes.min.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body {
            background-color: #212529;
            color: #fff;
            font-family: 'Press Start 2P', cursive;
            padding: 2rem;
            min-height: 100vh;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        .nes-container {
            background-color: #212529;
            color: #fff;
            border-color: #fff;
        }
        .nes-container.with-title > .title {
            background-color: #212529;
            color: #fff;
        }
        .roast-content {
            line-height: 1.8;
            margin-top: 1rem;
            font-size: 14px;
        }
        .roast-content h1, .roast-content h2, .roast-content h3 {
            color: #e76f51;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        .roast-content p {
            margin-bottom: 1rem;
        }
        .roast-content code {
            background-color: #000;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            color: #2a9d8f;
        }
        .roast-content pre {
            background-color: #000;
            padding: 1rem;
            border: 4px solid #fff;
            overflow-x: auto;
            margin-bottom: 1rem;
        }
        .roast-content pre code {
            background-color: transparent;
            color: #e9c46a;
            padding: 0;
            border-radius: 0;
        }
        #loading {
            text-align: center;
            margin: 4rem 0;
            color: #e9c46a;
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0; }
            100% { opacity: 1; }
        }
        .avatar {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 20px;
        }
        .nes-balloon {
            flex: 1;
        }
        .nes-balloon.from-left::before {
            border-right-color: #fff;
        }
        .nes-balloon {
            background-color: #212529;
            color: #fff;
            border-color: #fff;
        }
        .cursor {
            display: inline-block;
            width: 10px;
            height: 1em;
            background-color: #fff;
            animation: blink 1s infinite;
            vertical-align: middle;
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="avatar" id="header-avatar" style="display: none;">
            <i class="nes-octocat animate"></i>
            <div class="nes-balloon from-left">
                <p>Nih gw periksa kode lu yang ampas itu...</p>
            </div>
        </div>

        <div class="nes-container with-title is-dark">
            <p class="title">Vibe Check Result</p>
            <div id="loading">Scanning code... Wait up, noob.</div>
            <div id="roast-output" class="roast-content"></div>
            <span id="cursor" class="cursor" style="display: none;"></span>
        </div>
    </div>

    <script>
        async function fetchRoast() {
            try {
                const res = await fetch('/api/roast');
                const data = await res.json();
                
                document.getElementById('loading').style.display = 'none';
                document.getElementById('header-avatar').style.display = 'flex';
                
                if (data.error) {
                    typeWriter(data.error + "\\n\\n" + (data.details || ''));
                } else {
                    const htmlContent = marked.parse(data.roast);
                    // To do a typewriter effect with HTML is tricky, so we'll just inject the HTML
                    // and apply a fade-in or simple reveal. For a true typewriter effect, 
                    // we can type text nodes and reveal elements, but let's do a simplified one 
                    // or just reveal it chunk by chunk if we want it fully typed.
                    
                    // Actually, a simpler way to typewrite HTML:
                    typeHTML(htmlContent, document.getElementById('roast-output'));
                }
            } catch (err) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('roast-output').innerText = 'Failed to connect to backend: ' + err.message;
            }
        }

        function typeWriter(text) {
            const el = document.getElementById('roast-output');
            let i = 0;
            const cursor = document.getElementById('cursor');
            cursor.style.display = 'inline-block';
            el.innerHTML = '';
            
            const timer = setInterval(() => {
                // Type multiple chars per tick for speed
                let charsPerTick = 3;
                while (i < text.length && charsPerTick > 0) {
                    el.innerHTML += text.charAt(i) === '\\n' ? '<br/>' : text.charAt(i);
                    i++;
                    charsPerTick--;
                }
                if (i >= text.length) {
                    clearInterval(timer);
                    cursor.style.display = 'none';
                }
            }, 10);
        }

        // Advanced typewriter for HTML
        function typeHTML(htmlStr, container) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlStr;
            const cursor = document.getElementById('cursor');
            cursor.style.display = 'inline-block';
            
            // Extract text nodes and element nodes in a flat array, retaining tags
            // For a perfect effect we could do a complex tree walk, but the simplest 
            // robust way is just replacing the innerHTML char by char of the raw string, 
            // making sure we instantly add tags.
            
            let i = 0;
            let currentHTML = "";
            let inTag = false;
            
            const timer = setInterval(() => {
                let charsPerTick = 5;
                while(i < htmlStr.length && charsPerTick > 0) {
                    let char = htmlStr[i];
                    currentHTML += char;
                    if (char === '<') inTag = true;
                    if (char === '>') inTag = false;
                    
                    // skip typing out the inner tag contents slowly
                    while(inTag && i < htmlStr.length - 1) {
                        i++;
                        char = htmlStr[i];
                        currentHTML += char;
                        if (char === '>') inTag = false;
                    }
                    
                    i++;
                    charsPerTick--;
                }
                
                container.innerHTML = currentHTML;
                
                if (i >= htmlStr.length) {
                    clearInterval(timer);
                    cursor.style.display = 'none';
                }
            }, 10);
        }

        fetchRoast();
    </script>
</body>
</html>`;
}
