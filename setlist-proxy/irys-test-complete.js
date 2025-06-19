require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Uploader } = require('@irys/upload');
const { Ethereum } = require('@irys/upload-ethereum');

// Irys upload functions
const getIrysUploader = async () => {
  try {
    const irysUploader = await Uploader(Ethereum)
      .withWallet(process.env.PRIVATE_KEY)
      .withRpc(process.env.SEPOLIA_RPC)
      .devnet();
    
    return irysUploader;
  } catch (error) {
    console.error('Error initializing Irys uploader:', error);
    throw error;
  }
};

const uploadFileToIrys = async (buffer, filename) => {
  try {
    const irysUploader = await getIrysUploader();
    
    const price = await irysUploader.getPrice(buffer.length);
    console.log(`📊 Estimated upload cost: ${price} wei`);
    
    const balance = await irysUploader.getBalance();
    console.log(`💰 Current balance: ${balance} wei`);
    
    const contentType = getContentType(filename);
    console.log(`🚀 Uploading ${filename}...`);
    console.log(`📄 Content-Type: ${contentType}`);
    
    const receipt = await irysUploader.upload(buffer, {
      tags: [
        { name: 'Content-Type', value: contentType },
        { name: 'Filename', value: filename },
      ]
    });
    
    const arweaveUrl = `https://gateway.irys.xyz/${receipt.id}`;
    console.log(`✅ Upload complete: ${arweaveUrl}`);
    console.log(`📋 Full receipt:`, JSON.stringify(receipt, null, 2));
    
    return {
      id: receipt.id,
      url: arweaveUrl,
      arUrl: `ar://${receipt.id}`,
      receipt: receipt
    };
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    throw error;
  }
};

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

const getContentType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes = {
    // Video formats
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    // Image formats
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    // Audio formats
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    // Default
    'default': 'application/octet-stream'
  };
  
  return contentTypes[ext] || contentTypes['default'];
};

// Updated function to upload actual file
async function uploadLocalFile() {
  try {
    console.log('🔧 Starting file upload...');
    
    // Your file path
    const filePath = '/Users/g/Downloads/IMG_3269.mov';
    
    // Check if file exists
    try {
      await fs.access(filePath);
      console.log('✅ File found:', filePath);
    } catch (error) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    // Get file stats
    const stats = await fs.stat(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
    
    console.log(`📁 File size: ${fileSizeInBytes} bytes (${fileSizeInMB} MB)`);
    
    // Read the file
    console.log('📖 Reading file...');
    const fileBuffer = await fs.readFile(filePath);
    
    // Extract filename from path
    const filename = path.basename(filePath);
    
    console.log('\n💰 Checking balance and pricing...');
    const balanceInfo = await checkBalance(fileBuffer.length);
    
    if (!balanceInfo.hasSufficientFunds) {
      console.log('⚠️  Insufficient funds for upload');
      console.log(`Need: ${balanceInfo.price} wei`);
      console.log(`Have: ${balanceInfo.balance} wei`);
      console.log('\n💡 You may need to fund your account with Sepolia ETH first');
      console.log('Get testnet ETH from: https://sepoliafaucet.com/');
      return;
    }
    
    console.log('\n🚀 Uploading file...');
    const result = await uploadFileToIrys(fileBuffer, filename);
    
    console.log('\n🎉 Success!');
    console.log('📄 File ID:', result.id);
    console.log('🌐 Gateway URL:', result.url);
    console.log('🔗 AR URL:', result.arUrl);
    console.log(`📹 Content Type: ${getContentType(filename)}`);
    
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    
    if (error.message.includes('Currency not supported')) {
      console.log('\n💡 Troubleshooting: Currency error usually means:');
      console.log('   - Wrong network configuration');
      console.log('   - RPC URL issues');
      console.log('   - Private key format problems');
    }
    
    if (error.message.includes('insufficient funds') || error.message.includes('balance')) {
      console.log('\n💡 You need Sepolia ETH in your wallet');
      console.log('   - Get testnet ETH from: https://sepoliafaucet.com/');
    }
  }
}

// Run the file upload
uploadLocalFile();