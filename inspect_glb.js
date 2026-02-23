const fs = require('fs');
const http = require('http');

// Simple script to read the first few bytes of the GLB file and check its structure, or we can just use three.js in a quick node script.
// Wait, a better way without installing three.js globally is to just read the JSON chunk of the GLB.

const glbPath = './frontend/public/models/avatar.glb';

try {
  const buffer = fs.readFileSync(glbPath);
  
  // GLB header is 12 bytes
  // Magic (4), Version (4), Length (4)
  const magic = buffer.toString('utf8', 0, 4);
  if (magic !== 'glTF') {
    console.error('Not a valid GLB file');
    process.exit(1);
  }
  
  // Chunk 0 is JSON
  // Chunk Length (4), Chunk Type (4), Chunk Data (Length)
  const chunk0Length = buffer.readUInt32LE(12);
  const chunk0Type = buffer.toString('utf8', 16, 20);
  
  if (chunk0Type !== 'JSON') {
    console.error('First chunk is not JSON');
    process.exit(1);
  }
  
  const jsonStr = buffer.toString('utf8', 20, 20 + chunk0Length);
  const glTF = JSON.parse(jsonStr);
  
  console.log("GLTF animations array length:", glTF.animations ? glTF.animations.length : 0);
  
  if (glTF.animations && glTF.animations.length > 0) {
    const anim = glTF.animations[0];
    console.log(`Animation Name: ${anim.name}`);
    console.log(`Number of channels: ${anim.channels ? anim.channels.length : 0}`);
    console.log(`Number of samplers: ${anim.samplers ? anim.samplers.length : 0}`);
    
    // Check if the samplers actually have more than one keyframe
    // We would need to look at the accessors for the samplers.
    if (glTF.accessors && anim.samplers) {
       for(let i=0; i < Math.min(3, anim.samplers.length); i++) {
          const sampler = anim.samplers[i];
          const inputAccessor = glTF.accessors[sampler.input];
          console.log(`Sampler ${i} frame count (input max-min or count): ${inputAccessor.count}`);
       }
    }
  } else {
    console.log("NO ANIMATIONS FOUND IN JSON HEADER");
  }
  
} catch (e) {
  console.error("Error analyzing GLB:", e);
}
