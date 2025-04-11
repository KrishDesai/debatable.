import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';


function App() {
  const [topic, setTopic] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [rebuttal, setRebuttal] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stopRecordingRef = useRef<() => void>(() => {});
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synth = window.speechSynthesis;

  useEffect(() => {
    // initialize speech recognition
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('');
        setLiveTranscription(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  //speak to text with Web Speech API
  const speakText = (text: string) => {
    if (synth.speaking) {
      synth.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.voice = synth.getVoices().find(voice => voice.name === 'Samantha') || null;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synth.speak(utterance);
  };

  //stop recording 
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
    if (synth.speaking) {
      synth.cancel();
      setIsSpeaking(false);
    }
  };

  //start recording 
  const handleStartRecording = async () => {
    if (!topic) {
      alert("Please enter a debate topic.");
      return;
    }

    setIsRecording(true);
    setIsLoading(false);
    setTranscription('');
    setRebuttal('');
    setAnalysis('');
    setLiveTranscription('');

    try {
      // start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'  
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsLoading(true);
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm;codecs=opus'
        });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('topic', topic);


        try {
          const response = await axios.post('http://localhost:8000/debate/full', formData);
          
          setTranscription(response.data.transcription);
          setRebuttal(response.data.rebuttal);
          setAnalysis(response.data.analysis);

          // Speak the rebuttal
          speakText(response.data.rebuttal);
        } catch (error) {
          console.error('Error:', error);
          alert('An error occurred while processing your debate. Please try again.');
        } finally {
          setIsLoading(false);
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please ensure you have granted microphone permissions.');
      setIsRecording(false);
    }
  };

  //ui
  return (
    <div className="App">
      <h1> Debatable. </h1>
      <h3>The AI Powered Debate Assistant.</h3>

      <div className="input-group">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter debate topic"
          disabled={isRecording}
        />
        {!isRecording ? (
          <button 
            onClick={handleStartRecording}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Start Debate'}
          </button>
        ) : (
          <button 
            onClick={handleStopRecording}
            className="recording"
          >
            Stop Recording
          </button>
        )}
      </div>

      {isRecording && (
        <div className="recording-status">
          <p>Recording in progress... Speak your argument</p>
          {liveTranscription && (
            <div className="live-transcription">
              <h3>Live Transcription:</h3>
              <p>{liveTranscription}</p>
            </div>
          )}
        </div>
      )}

      {transcription && (
        <div className="debate-section">
          <h2>Your Argument</h2>
          <p>{transcription}</p>
        </div>
      )}

      {rebuttal && (
        <div className="debate-section">
          <h2> Debatable's Response</h2>
          <p>{rebuttal}</p>
          <button 
            onClick={() => speakText(rebuttal)}
            disabled={isSpeaking}
            className={isSpeaking ? 'speaking' : ''}
          >
            {isSpeaking ? 'Speaking...' : 'Play Response'}
          </button>
        </div>
      )}

      {analysis && (
        <div className="analysis-section">
          <h2>Debate Analysis</h2>
          <div className="analysis-content">
            {analysis.split('\n').map((line, index) => {
              if (!line.trim()) return null;

              // If line starts with a bullet point
              if (line.trim().startsWith('•')) {
                return (
                  <div key={index} className="analysis-bullet">
                    {line.trim().substring(1).trim()}
                  </div>
                );
              }

              // if line is a section header
              return (
                <h3 key={index} className="analysis-header">
                  {line.trim()}
                </h3>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export default App;
