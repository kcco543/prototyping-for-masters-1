/**
 * Sound-Sensitive Cat — one short, synthesised "meow".
 *
 * There is no sound file: the meow is built from scratch with the Web Audio
 * API, the same way a synthesiser makes a voice.
 *
 *   1. A buzzy tone (a "sawtooth" wave) plays the voice. Its pitch slides
 *      up and then down: "mi-AOW".
 *   2. Two filters shape the buzz into vowels, the way your mouth does.
 *      Sliding them from "ee" to "ah" to "oo" is what makes it sound like
 *      "m-ee-ah-oo" rather than a beep.
 *   3. A volume envelope fades it in quickly and out gently.
 *
 * It is only played after the visitor has clicked the microphone button, so
 * the page never makes a sound on its own.
 */

export function meow(context: AudioContext, volume = 0.16) {
  const start = context.currentTime + 0.02;
  const end = start + 0.62;

  // 1. The voice: pitch rises, then falls
  const voice = context.createOscillator();
  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(470, start);
  voice.frequency.linearRampToValueAtTime(700, start + 0.14);
  voice.frequency.linearRampToValueAtTime(640, start + 0.3);
  voice.frequency.exponentialRampToValueAtTime(380, end);

  // A little wobble in the pitch (vibrato) makes it sound alive
  const wobble = context.createOscillator();
  const wobbleDepth = context.createGain();
  wobble.frequency.value = 7;
  wobbleDepth.gain.value = 9;
  wobble.connect(wobbleDepth).connect(voice.frequency);

  // 2. The "mouth": two vowel filters sliding from "ee" to "ah" to "oo"
  const low = context.createBiquadFilter();
  low.type = "bandpass";
  low.Q.value = 4;
  low.frequency.setValueAtTime(450, start);
  low.frequency.linearRampToValueAtTime(950, start + 0.2);
  low.frequency.linearRampToValueAtTime(600, end);

  const high = context.createBiquadFilter();
  high.type = "bandpass";
  high.Q.value = 6;
  high.frequency.setValueAtTime(2300, start);
  high.frequency.linearRampToValueAtTime(1500, start + 0.22);
  high.frequency.linearRampToValueAtTime(950, end);
  const highLevel = context.createGain();
  highLevel.gain.value = 0.55;

  // 3. The volume: quickly in, gently out
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.05);
  envelope.gain.setValueAtTime(volume, start + 0.32);
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);

  voice.connect(low).connect(envelope);
  voice.connect(high).connect(highLevel).connect(envelope);
  envelope.connect(context.destination);

  voice.start(start);
  wobble.start(start);
  voice.stop(end + 0.05);
  wobble.stop(end + 0.05);
  // Tidy up once it has finished
  voice.onended = () => {
    for (const node of [voice, wobble, wobbleDepth, low, high, highLevel, envelope]) node.disconnect();
  };
}
