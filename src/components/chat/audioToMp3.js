import lamejs from '@breezystack/lamejs'

const getMp3EncoderClass = () => {
  return lamejs?.Mp3Encoder || lamejs?.default?.Mp3Encoder
}

const clampToInt16 = float32 => {
  const value = Math.max(-1, Math.min(1, float32))
  return value < 0 ? value * 0x8000 : value * 0x7fff
}

const floatToInt16Array = float32Array => {
  const output = new Int16Array(float32Array.length)
  for (let index = 0; index < float32Array.length; index += 1) {
    output[index] = clampToInt16(float32Array[index])
  }
  return output
}

const encodeAudioBufferToMp3 = (audioBuffer, bitRateKbps = 128) => {
  const Mp3Encoder = getMp3EncoderClass()
  if (!Mp3Encoder) {
    throw new Error('No se encontró el codificador MP3 (lamejs).')
  }

  const channelCount = Math.min(audioBuffer.numberOfChannels || 1, 2)
  const sampleRate = audioBuffer.sampleRate || 44100
  const encoder = new Mp3Encoder(channelCount, sampleRate, bitRateKbps)
  const blockSize = 1152
  const mp3Chunks = []

  if (channelCount === 1) {
    const leftChannel = floatToInt16Array(audioBuffer.getChannelData(0))

    for (let i = 0; i < leftChannel.length; i += blockSize) {
      const leftChunk = leftChannel.subarray(i, i + blockSize)
      const encodedChunk = encoder.encodeBuffer(leftChunk)
      if (encodedChunk.length > 0) mp3Chunks.push(new Uint8Array(encodedChunk))
    }
  } else {
    const leftChannel = floatToInt16Array(audioBuffer.getChannelData(0))
    const rightChannel = floatToInt16Array(audioBuffer.getChannelData(1))

    for (let i = 0; i < leftChannel.length; i += blockSize) {
      const leftChunk = leftChannel.subarray(i, i + blockSize)
      const rightChunk = rightChannel.subarray(i, i + blockSize)
      const encodedChunk = encoder.encodeBuffer(leftChunk, rightChunk)
      if (encodedChunk.length > 0) mp3Chunks.push(new Uint8Array(encodedChunk))
    }
  }

  const endChunk = encoder.flush()
  if (endChunk.length > 0) mp3Chunks.push(new Uint8Array(endChunk))

  return new Blob(mp3Chunks, { type: 'audio/mpeg' })
}

const createAudioContext = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) {
    throw new Error(
      'Tu navegador no soporta AudioContext para convertir audio.'
    )
  }
  return new AudioCtx()
}

export async function convertBlobToMp3File(
  blob,
  fileName = `audio-${Date.now()}.mp3`
) {
  if (!blob || blob.size === 0) {
    throw new Error('No hay audio para convertir.')
  }

  const audioContext = createAudioContext()
  try {
    const sourceBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(
      sourceBuffer.slice(0)
    )
    const mp3Blob = encodeAudioBufferToMp3(audioBuffer)

    return new File([mp3Blob], fileName, {
      type: 'audio/mpeg',
      lastModified: Date.now(),
    })
  } finally {
    try {
      await audioContext.close()
    } catch {}
  }
}
