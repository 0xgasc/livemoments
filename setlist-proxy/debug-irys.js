require('dotenv').config();
const { Uploader } = require('@irys/upload');
const { Ethereum } = require('@irys/upload-ethereum');
const { JsonRpcProvider, Wallet, formatEther } = require('ethers');

async function debugIrysConnection() {
  try {
    console.log('🔧 Debugging Irys connection...');
    
    // First, let's check what wallet Irys is using
    const wallet = new Wallet(process.env.PRIVATE_KEY);
    console.log(`🏦 Expected wallet address: ${wallet.address}`);
    
    // Create Irys uploader
    console.log('🔗 Connecting to Irys...');
    const irysUploader = await Uploader(Ethereum)
      .withWallet(process.env.PRIVATE_KEY)
      .withRpc(process.env.SEPOLIA_RPC)
      .devnet();
    
    console.log('✅ Irys connection established');
    
    // Check what address Irys thinks it's using
    const irysAddress = irysUploader.address;
    console.log(`🏦 Irys wallet address: ${irysAddress}`);
    
    if (wallet.address.toLowerCase() !== irysAddress.toLowerCase()) {
      console.log('❌ ADDRESS MISMATCH! This is the problem.');
      return;
    }
    
    // Check Irys balance
    console.log('💰 Checking Irys balance...');
    const irysBalance = await irysUploader.getBalance();
    console.log(`💰 Irys balance: ${irysBalance} wei`);
    console.log(`💰 Irys balance: ${formatEther(irysBalance)} ETH`);
    
    // Check direct wallet balance for comparison
    const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC);
    const directBalance = await provider.getBalance(wallet.address);
    console.log(`💰 Direct balance: ${directBalance} wei`);
    console.log(`💰 Direct balance: ${formatEther(directBalance)} ETH`);
    
    // Try to fund Irys if needed
    if (BigInt(irysBalance) === 0n && BigInt(directBalance) > 0n) {
      console.log('💸 Attempting to fund Irys account...');
      // Fund with a small amount (0.001 ETH = 1000000000000000 wei)
      const fundAmount = BigInt('1000000000000000'); // 0.001 ETH
      await irysUploader.fund(fundAmount);
      console.log('✅ Funded Irys account');
      
      // Check balance again
      const newBalance = await irysUploader.getBalance();
      console.log(`💰 New Irys balance: ${newBalance} wei`);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    console.error('Full error:', error);
  }
}

debugIrysConnection();