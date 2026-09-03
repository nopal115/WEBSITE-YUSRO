import { Button } from '../ui'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

export function AudioRecorderButton() {
  const recorder = useAudioRecorder()
  return <Button onClick={recorder.isRecording ? recorder.stop : recorder.start}>{recorder.isRecording ? 'Stop' : 'Record'}</Button>
}
