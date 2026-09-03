import { useRef, useState } from 'react'

export function useAudioRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorderRef.current = new MediaRecorder(stream)
    recorderRef.current.start()
    setIsRecording(true)
  }

  const stop = () => {
    recorderRef.current?.stop()
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    setIsRecording(false)
  }

  return { isRecording, start, stop }
}
