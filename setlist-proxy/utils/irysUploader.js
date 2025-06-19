require('dotenv').config();
const { Uploader } = require('@irys/upload');
const { Ethereum } = require('@irys/upload-ethereum');

const getIrysUploader = async () => {
  try {
    const irysUploader = await Uploader(Ethereum)
      .withWallet(process.env.PRIVATE_KEY)
      .withRpc(process.env.SEPOLIA_RPC) // Use your Sepolia RPC
      .devnet(); // Use devnet for testnet tokens like Sepolia ETH
    
    return irysUploader;
  } catch (error) {
    console.error('Error initializing Irys uploader:', error);
    throw error;
  }
};

const uploadFileToIrys = async (buffer, filename) => {
  try {
    const irysUploader = await getIrysUploader();
    
    // Optional: Check price before upload
    const price = await irysUploader.getPrice(buffer.length);
    console.log(`📊 Estimated upload cost: ${price} wei`);
    
    // Optional: Check balance
    const balance = await irysUploader.getBalance();
    console.log(`💰 Current balance: ${balance} wei`);
    
    // Upload the file
    console.log(`🚀 Uploading ${filename}...`);
    const receipt = await irysUploader.upload(buffer, [
      { name: 'Content-Type', value: getContentType(filename) },
      { name: 'Filename', value: filename },
    ]);
    
    const arweaveUrl = `https://gateway.irys.xyz/${receipt.id}`;
    console.log(`✅ Upload complete: ${arweaveUrl}`);
    
    return {
      id: receipt.id,
      url: arweaveUrl,
      arUrl: `ar://${receipt.id}`
    };
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    throw error;
  }
};

// Helper function to determine content type
const getContentType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    
    // Default
    'default': 'application/octet-stream'
  };
  
  return contentTypes[ext] || contentTypes['default'];
};

// Optional: Fund your account if needed
const fundAccount = async (amount) => {
  try {
    const irysUploader = await getIrysUploader();
    const receipt = await irysUploader.fund(amount);
    console.log(`💸 Funded account with ${amount} wei. Receipt:`, receipt);
    return receipt;
  } catch (error) {
    console.error('❌ Funding error:', error);
    throw error;
  }
};

// Optional: Check if you have enough balance for upload
const checkBalance = async (bufferSize) => {
  try {
    const irysUploader = await getIrysUploader();
    const price = await irysUploader.getPrice(bufferSize);
    const balance = await irysUploader.getBalance();
    
    console.log(`💰 Balance: ${balance} wei`);
    console.log(`💵 Cost: ${price} wei`);
    console.log(`✅ Sufficient funds: ${BigInt(balance) >= BigInt(price)}`);
    
    return {
      balance,
      price,
      hasSufficientFunds: BigInt(balance) >= BigInt(price)
    };
  } catch (error) {
    console.error('❌ Balance check error:', error);
    throw error;
  }
};

module.exports = { 
  uploadFileToIrys, 
  fundAccount, 
  checkBalance 
};