# UI sound clips

Short WAV clips used directly by the frontend sound system.

- `action-soft.wav`, `chat-note.wav`, `error-caution.wav`, and `success-note.wav` are trimmed clips exported from the SND UI sound kit sprites.
- `toast-ping.wav`, `reaction-pop.wav`, and `call-end.wav` are generated short UI tones for distinct notification, reaction, and call-end feedback.

The app loads these clips into Web Audio buffers instead of seeking inside long audio sprites.
