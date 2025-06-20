require('dotenv').config();
const Bundlr = require('@bundlr-network/client').default;
const { JsonRpcProvider, Wallet, formatEther } = require('ethers');
const crypto = require('crypto');

async function getBundlr() {
  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

  const bundlr = new Bundlr(
    'https://node1.bundlr.network',
    'ethereum',
    wallet.privateKey,
    { providerUrl: process.env.SEPOLIA_RPC }
  );

  await bundlr.ready();
  return bundlr;
}

// Content type detection function
function getContentType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'ico': 'image/x-icon',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',        // ✅ This is what was missing!
    'avi': 'video/x-msvideo',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'wma': 'audio/x-ms-wma',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    
    // Default fallback
    'default': 'application/octet-stream'
  };
  
  return contentTypes[ext] || contentTypes['default'];
}

async function estimateAndUpload(buffer, filename) {
  try {
    console.log(`🔍 Bundlr Upload Debug:`);
    console.log(`   - Filename: ${filename}`);
    console.log(`   - Buffer size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   - Buffer type: ${Buffer.isBuffer(buffer) ? 'Buffer' : typeof buffer}`);
    
    // Validate buffer
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Invalid buffer provided - not a Buffer object');
    }
    
    if (buffer.length === 0) {
      throw new Error('Empty buffer provided');
    }
    
    // Create hash for verification
    const originalHash = crypto.createHash('md5').update(buffer).digest('hex');
    console.log(`   - Original MD5: ${originalHash}`);
    
    const bundlr = await getBundlr();
    const price = await bundlr.utils.getPrice(buffer.length);
    console.log(`✔️  Estimated price: ${formatEther(price.toString())} ETH`);

    const balance = await bundlr.getLoadedBalance();
    console.log(`💰 Current Bundlr balance: ${formatEther(balance.toString())} ETH`);

    if (balance.lt(price)) {
      const diff = price.sub(balance);
      console.log(`➕ Funding Bundlr with ${formatEther(diff.toString())} ETH...`);
      await bundlr.fund(diff);
    }

    // Detect proper content type
    const contentType = getContentType(filename);
    console.log(`   - Detected Content-Type: ${contentType}`);

    console.log(`🚀 Uploading ${filename}...`);
    const tx = await bundlr.upload(buffer, {
      tags: [
        { name: 'Content-Type', value: contentType },  // ✅ Now using proper content type!
        { name: 'Filename', value: filename },
        { name: 'Original-Size', value: buffer.length.toString() },
        { name: 'Original-MD5', value: originalHash },
        { name: 'Upload-Timestamp', value: new Date().toISOString() }
      ],
    });

    const arweaveUrl = `https://arweave.net/${tx.id}`;
    console.log('✅ Upload complete:', arweaveUrl);
    console.log(`   - Transaction ID: ${tx.id}`);
    
    return arweaveUrl;
    
  } catch (error) {
    console.error('❌ Bundlr upload error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      filename,
      bufferSize: buffer?.length
    });
    throw error;
  }
}

// Optional: Test function to verify upload
async function verifyUpload(arweaveUrl, expectedHash) {
  try {
    console.log(`🔍 Verifying Bundlr upload...`);
    const fetch = (await import('node-fetch')).default;
    
    // Wait a bit for Arweave propagation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(arweaveUrl);
    
    if (!response.ok) {
      console.log(`⏳ File not yet available, this is normal for Arweave uploads`);
      return false;
    }
    
    const uploadedBuffer = await response.buffer();
    const uploadedHash = crypto.createHash('md5').update(uploadedBuffer).digest('hex');
    
    console.log(`   - Expected MD5: ${expectedHash}`);
    console.log(`   - Uploaded MD5: ${uploadedHash}`);
    console.log(`   - Integrity check: ${expectedHash === uploadedHash ? '✅ PASS' : '❌ FAIL'}`);
    
    return expectedHash === uploadedHash;
  } catch (error) {
    console.log(`⏳ Verification failed (normal for new Arweave uploads):`, error.message);
    return false;
  }
}

// Hybrid upload: save large buffers to temp file then stream for memory efficiency
async function hybridUpload(buffer, filename) {
  const fileSizeGB = (buffer.length / 1024 / 1024 / 1024).toFixed(2);
  
  // For files larger than 1GB, use temp file approach to save memory
  if (buffer.length > 1024 * 1024 * 1024) {
    console.log(`📁 Large file (${fileSizeGB}GB) detected, using hybrid upload approach...`);
    
    const fs = require('fs');
    const path = require('path');
    
    // Create temporary file
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempPath = path.join(tempDir, `upload_${Date.now()}_${filename}`);
    
    try {
      // Write buffer to temp file
      console.log(`💾 Writing ${fileSizeGB}GB to temporary file for streaming...`);
      fs.writeFileSync(tempPath, buffer);
      
      // Get file stats
      const stats = fs.statSync(tempPath);
      
      const bundlr = await getBundlr();
      const price = await bundlr.utils.getPrice(stats.size);
      console.log(`✔️  Estimated price: ${formatEther(price.toString())} ETH`);

      const balance = await bundlr.getLoadedBalance();
      console.log(`💰 Current Bundlr balance: ${formatEther(balance.toString())} ETH`);

      if (balance.lt(price)) {
        const diff = price.sub(balance);
        console.log(`➕ Funding Bundlr with ${formatEther(diff.toString())} ETH...`);
        await bundlr.fund(diff);
      }

      const contentType = getContentType(filename);
      console.log(`   - Detected Content-Type: ${contentType}`);

      console.log(`🚀 Streaming upload of ${filename} (${fileSizeGB}GB)...`);
      
      // Create read stream and upload
      const readStream = fs.createReadStream(tempPath);
      
      const tx = await bundlr.upload(readStream, {
        tags: [
          { name: 'Content-Type', value: contentType },
          { name: 'Filename', value: filename },
          { name: 'Original-Size', value: stats.size.toString() },
          { name: 'Upload-Timestamp', value: new Date().toISOString() }
        ],
      });

      const arweaveUrl = `https://arweave.net/${tx.id}`;
      console.log('✅ Hybrid upload complete:', arweaveUrl);
      console.log(`   - Transaction ID: ${tx.id}`);
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
      console.log(`🗑️  Cleaned up temporary file`);
      
      return arweaveUrl;
      
    } catch (error) {
      // Clean up temp file on error
      const fs = require('fs');
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log(`🗑️  Cleaned up temporary file after error`);
      }
      throw error;
    }
  } else {
    // For smaller files, use direct buffer upload
    return await estimateAndUpload(buffer, filename);
  }
}

module.exports = { 
  estimateAndUpload,
  hybridUpload,
  verifyUpload,
  getContentType
};