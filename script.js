
document.getElementById('videoFile').addEventListener('change', function(e){
    const fileName = e.target.files[0]?.name || 'Choose Video File';
    document.getElementById('fileName').textContent = fileName; 
})


async function generateSubtitles(){

    const userAPI = document.getElementById('userAPI').value.trim();
    const videoFile = document.getElementById('videoFile').files[0];
    const videoURL = document.getElementById('videoURL').value;
    const statusDiv = document.getElementById('status');

    //validate input
    if(!userAPI){
        statusDiv.textContent = 'please enter API key';
        return;
    }

    if(!videoURL && !videoFile){
        statusDiv.textContent = 'Please either upload a file or paste a video link';
        return;
    }

    if(videoFile && videoURL){
        statusDiv.textContent = 'Please use either a file or URL, not both';
        return;
    }


    try{
        let videoBlob;
        if(videoFile){
            statusDiv.textContent = 'Preparing Video...';
            videoBlob = videoFile;
        }
        else{
        //=====Downlaod video=====

        statusDiv.textContent = 'Downloading video...';

                    //CORS
        
        const proxyURL = 'https://corsproxy.io/?';
        const fetchURL = videoURL.includes('pexels.com') ? proxyURL + encodeURIComponent(videoURL) : videoURL;

        const videoResponse = await fetch(fetchURL);
        if(!videoResponse.ok){
            throw new Error('Failed to download video');
        }
        videoBlob = await videoResponse.blob();
    }
        //uplaod to Gemini
        statusDiv.textContent = 'Uploading to AssemblyAI...';
        
        const uploadResponse = await fetch(
            `https://api.assemblyai.com/v2/upload`,
            { method: 'POST', 
            headers: {
                'authorization' : userAPI
            },    
            body: videoBlob }
        );

        const uplaodData = await uploadResponse.json()

        if(!uploadResponse.ok){
            throw new Error(uplaodData.error?.message || 'Upload failed');
        }

        const audioUrl = uplaodData.upload_url;


        //request transcription
        statusDiv.textContent = 'Requesting Transcription...';

        const transcriptionResponse = await fetch('https://api.assemblyai.com/v2/transcript',
            {method: 'POST',
            headers: {'authorization' : userAPI,
                          'content-type': 'application/json' 
                },
            body: JSON.stringify({
                    audio_url: audioUrl 
                })
                
            });

        const transcriptData = await transcriptionResponse.json();
        const transcriptId = transcriptData.id;


        //wait for processing

        statusDiv.textContent = 'Processsing video...';

        let status = 'processing';
        let attempts = 0;
        while(status === 'processing' || status === 'queued'){
            await new Promise(resolve => setTimeout(resolve, 3000));

            const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                {headers: {'authorization' : userAPI}}
            );

            const result = await pollingResponse.json();
            status = result.status;
            attempts++;
            statusDiv.textContent = `Processing... ${attempts * 3}s`;

            if(status === 'completed'){
                statusDiv.textContent = "Generating subtitles";
            
                const srtResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}/srt`,
                    {headers : {'authorization' : userAPI}}
                );

                const subtitles = await srtResponse.text();
                //display subtitles
                document.getElementById('subtitles').textContent = subtitles;
                document.getElementById('downloadBtn').style.display = 'block';
                statusDiv.textContent = 'Subtitle generated successfully';
                return;
            }
            if(status === 'error'){
                throw new Error('Transcript failed');
            }
        }
    }
    catch(error){
        statusDiv.textContent = "Error" + error.message;
        console.error(error);
    }
}

document.getElementById('downloadBtn').addEventListener('click', function(){
    const subtitles = document.getElementById('subtitles').textContent;

    //create a blob(file in memory)
    const blob = new Blob([subtitles], {type: 'text/plain'});

    //create downlaod link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();

    //clean up
    URL.revokeObjectURL(url);
});