require('dotenv').config();
const { Uploader } = require('@irys/upload');
const { Ethereum } = require('@irys/upload-ethereum');

// Initialize Irys uploader
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

// Convert wei to ETH
const weiToEth = (wei) => {
  return (BigInt(wei) / BigInt(1e18)).toString() + '.' + 
         (BigInt(wei) % BigInt(1e18)).toString().padStart(18, '0').slice(0, 6);
};

// Convert wei to readable format
const formatWei = (wei) => {
  const ethValue = parseFloat(wei) / 1e18;
  return ethValue.toFixed(6);
};

// Get Sepolia transactions to track spending
async function getSepoliaTransactions(walletAddress) {
  try {
    console.log('\n💸 Spending Analysis (Sepolia Transactions):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Using Etherscan API for Sepolia testnet
    const apiKey = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken'; // You can get a free one from etherscan.io
    const url = `https://api-sepolia.etherscan.io/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '0' && data.message === 'No transactions found') {
      console.log('📭 No Sepolia transactions found');
      return { totalSpent: 0, uploadCount: 0, transactions: [] };
    }
    
    if (data.status === '0') {
      console.log('❌ Error fetching transactions:', data.message);
      console.log('💡 You may need an Etherscan API key for detailed transaction data');
      return await getFallbackSpendingData(walletAddress);
    }
    
    const transactions = data.result || [];
    const outgoingTxs = transactions.filter(tx => 
      tx.from.toLowerCase() === walletAddress.toLowerCase() && 
      tx.value !== '0'
    );
    
    let totalSpent = BigInt(0);
    let uploadCount = 0;
    const recentUploads = [];
    
    console.log(`📊 Found ${outgoingTxs.length} outgoing transactions\n`);
    
    outgoingTxs.slice(0, 10).forEach((tx, index) => {
      const valueEth = formatWei(tx.value);
      const gasUsed = BigInt(tx.gasUsed || 0) * BigInt(tx.gasPrice || 0);
      const totalCost = BigInt(tx.value) + gasUsed;
      const totalCostEth = formatWei(totalCost.toString());
      const timestamp = new Date(parseInt(tx.timeStamp) * 1000).toLocaleString();
      
      totalSpent += totalCost;
      
      // Assume transactions with significant value are uploads
      if (parseFloat(valueEth) > 0.0001) {
        uploadCount++;
        recentUploads.push({
          hash: tx.hash,
          value: valueEth,
          totalCost: totalCostEth,
          timestamp: timestamp,
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice
        });
        
        console.log(`📤 Upload ${uploadCount}:`);
        console.log(`   🆔 TX Hash: ${tx.hash}`);
        console.log(`   📅 Date: ${timestamp}`);
        console.log(`   💰 Value: ${valueEth} ETH`);
        console.log(`   ⛽ Gas Cost: ${formatWei(gasUsed.toString())} ETH`);
        console.log(`   💸 Total Cost: ${totalCostEth} ETH`);
        console.log(`   🔗 Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}\n`);
      }
    });
    
    return {
      totalSpent: formatWei(totalSpent.toString()),
      uploadCount,
      transactions: recentUploads
    };
    
  } catch (error) {
    console.error('❌ Error fetching Sepolia transactions:', error.message);
    return await getFallbackSpendingData(walletAddress);
  }
}

// Fallback method to estimate spending based on current balance and typical funding
async function getFallbackSpendingData(walletAddress) {
  console.log('\n💡 Using estimation method (limited transaction data available)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const irysUploader = await getIrysUploader();
    const currentBalance = await irysUploader.getBalance();
    const currentBalanceEth = parseFloat(formatWei(currentBalance));
    
    // Common testnet funding amounts
    const commonFundingAmounts = [0.1, 0.5, 1.0, 2.0, 5.0];
    
    console.log(`💰 Current Balance: ${currentBalanceEth} ETH`);
    console.log('\n🤔 Spending Estimation:');
    console.log('   Based on common testnet funding patterns...\n');
    
    for (const fundingAmount of commonFundingAmounts) {
      const estimatedSpent = fundingAmount - currentBalanceEth;
      if (estimatedSpent > 0) {
        console.log(`📊 If you started with ${fundingAmount} ETH:`);
        console.log(`   💸 Estimated spent: ${estimatedSpent.toFixed(6)} ETH`);
        console.log(`   📊 Usage: ${((estimatedSpent / fundingAmount) * 100).toFixed(1)}%\n`);
      }
    }
    
    return {
      totalSpent: 'Unknown',
      uploadCount: 'Unknown',
      transactions: []
    };
    
  } catch (error) {
    console.error('❌ Error in fallback estimation:', error.message);
    return { totalSpent: 'Unknown', uploadCount: 'Unknown', transactions: [] };
  }
}

// Get Irys devnet transactions (for uploaded files)
async function getIrysDevnetTransactions(walletAddress) {
  try {
    console.log('\n📁 Irys Devnet Upload History:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Query Irys devnet GraphQL endpoint
    const query = `
      query getTransactions($owners: [String!]) {
        transactions(
          owners: $owners
          first: 10
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              block {
                height
                timestamp
              }
              owner {
                address
              }
              data {
                size
                type
              }
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;
    
    const variables = { owners: [walletAddress] };
    
    // Try Irys devnet GraphQL endpoint
    const response = await fetch('https://devnet.irys.xyz/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    
    const data = await response.json();
    
    if (data.errors) {
      console.log('⚠️  Limited upload history available from Irys devnet');
      console.log('💡 Files may still be processing or indexed');
      return [];
    }
    
    const transactions = data.data?.transactions?.edges || [];
    
    if (transactions.length === 0) {
      console.log('📭 No upload history found on Irys devnet');
      console.log('💡 Uploads may take time to be indexed');
      return [];
    }
    
    const uploads = [];
    
    transactions.forEach((edge, index) => {
      const tx = edge.node;
      const timestamp = tx.block ? new Date(tx.block.timestamp * 1000).toLocaleString() : 'Pending';
      const dataSize = tx.data.size ? (tx.data.size / 1024 / 1024).toFixed(2) : 'Unknown';
      
      const filenameTag = tx.tags.find(tag => tag.name === 'Filename');
      const contentTypeTag = tx.tags.find(tag => tag.name === 'Content-Type');
      const filename = filenameTag ? filenameTag.value : 'Unknown';
      const contentType = contentTypeTag ? contentTypeTag.value : 'Unknown';
      
      uploads.push({
        id: tx.id,
        filename,
        size: dataSize,
        contentType,
        timestamp
      });
      
      console.log(`\n📤 Upload ${index + 1}:`);
      console.log(`   🆔 Transaction ID: ${tx.id}`);
      console.log(`   📁 Filename: ${filename}`);
      console.log(`   📊 Size: ${dataSize} MB`);
      console.log(`   📄 Type: ${contentType}`);
      console.log(`   📅 Date: ${timestamp}`);
      console.log(`   🌐 Gateway URL: https://gateway.irys.xyz/${tx.id}`);
      console.log(`   🔗 AR URL: ar://${tx.id}`);
    });
    
    return uploads;
    
  } catch (error) {
    console.error('❌ Error fetching Irys transactions:', error.message);
    return [];
  }
}

// Main balance checker function
async function checkIrysBalance() {
  try {
    console.log('🔍 Checking Irys balance...\n');
    
    const irysUploader = await getIrysUploader();
    const balance = await irysUploader.getBalance();
    
    console.log('📊 Balance Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 Raw balance: ${balance} wei`);
    console.log(`💰 Balance in ETH: ${formatWei(balance)} ETH`);
    
    // Calculate USD value (approximate)
    const ethPrice = 2500; // Approximate ETH price - you can update this
    const usdValue = (parseFloat(formatWei(balance)) * ethPrice).toFixed(2);
    console.log(`💵 Approximate USD value: $${usdValue} (at $${ethPrice}/ETH)`);
    
    // Show some upload cost estimates
    console.log('\n📈 Upload Cost Estimates:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const fileSizes = [
      { name: '1 MB file', bytes: 1024 * 1024 },
      { name: '10 MB file', bytes: 10 * 1024 * 1024 },
      { name: '50 MB file', bytes: 50 * 1024 * 1024 },
      { name: '100 MB file', bytes: 100 * 1024 * 1024 }
    ];
    
    for (const fileSize of fileSizes) {
      try {
        const price = await irysUploader.getPrice(fileSize.bytes);
        const priceEth = formatWei(price);
        const canAfford = BigInt(balance) >= BigInt(price);
        const affordIcon = canAfford ? '✅' : '❌';
        
        console.log(`${affordIcon} ${fileSize.name}: ${priceEth} ETH`);
      } catch (error) {
        console.log(`❓ ${fileSize.name}: Error calculating price`);
      }
    }
    
    return { balance: formatWei(balance), irysUploader };
    
  } catch (error) {
    console.error('\n❌ Error checking balance:', error.message);
    throw error;
  }
}

// Add wallet address checker
async function getWalletInfo() {
  try {
    const irysUploader = await getIrysUploader();
    const address = irysUploader.address;
    
    console.log('\n🏦 Wallet Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Wallet Address: ${address}`);
    console.log(`🔗 Etherscan: https://sepolia.etherscan.io/address/${address}`);
    
    return address;
  } catch (error) {
    console.error('❌ Error getting wallet info:', error.message);
    return null;
  }
}

// Generate comprehensive spending report
function generateSpendingReport(currentBalance, spendingData, uploads) {
  console.log('\n📋 Comprehensive Spending Report:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log(`💰 Current Balance: ${currentBalance} ETH`);
  
  if (spendingData.totalSpent !== 'Unknown') {
    console.log(`💸 Total Spent: ${spendingData.totalSpent} ETH`);
    console.log(`📤 Upload Transactions: ${spendingData.uploadCount}`);
    
    const totalValue = parseFloat(currentBalance) + parseFloat(spendingData.totalSpent);
    const spentPercentage = ((parseFloat(spendingData.totalSpent) / totalValue) * 100).toFixed(1);
    
    console.log(`📊 Total Account Value: ${totalValue.toFixed(6)} ETH`);
    console.log(`📈 Spent Percentage: ${spentPercentage}%`);
    
    if (spendingData.uploadCount > 0) {
      const avgCostPerUpload = (parseFloat(spendingData.totalSpent) / spendingData.uploadCount).toFixed(6);
      console.log(`📊 Average Cost per Upload: ${avgCostPerUpload} ETH`);
    }
  } else {
    console.log(`💸 Total Spent: ${spendingData.totalSpent} (estimation method used)`);
  }
  
  console.log(`📁 Files on Irys: ${uploads.length} found`);
  
  if (parseFloat(currentBalance) < 0.001) {
    console.log('\n⚠️  Low balance warning! Consider adding more Sepolia ETH');
    console.log('🚰 Get testnet ETH from: https://sepoliafaucet.com/');
  } else {
    console.log('\n✅ Balance looks good for uploads!');
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (uploads.length > 0 && spendingData.uploadCount > 0) {
    console.log('✅ Upload activity detected - system working well');
  }
  if (spendingData.totalSpent !== 'Unknown' && parseFloat(spendingData.totalSpent) > 0.01) {
    console.log('💰 Significant spending detected - monitor usage');
  }
  console.log('📊 For detailed transaction history, get a free Etherscan API key');
  console.log('🔄 Run this script regularly to track spending patterns');
}

// Run all functions
async function main() {
  try {
    const { balance } = await checkIrysBalance();
    const walletAddress = await getWalletInfo();
    
    if (!walletAddress) {
      console.error('❌ Could not get wallet address');
      return;
    }
    
    const spendingData = await getSepoliaTransactions(walletAddress);
    const uploads = await getIrysDevnetTransactions(walletAddress);
    
    generateSpendingReport(balance, spendingData, uploads);
    
  } catch (error) {
    console.error('\n❌ Script execution error:', error.message);
    
    if (error.message.includes('Currency not supported')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('   - Check your .env file has PRIVATE_KEY and SEPOLIA_RPC');
      console.log('   - Verify your private key format');
      console.log('   - Ensure RPC URL is correct');
    }
  }
}

// Execute the enhanced balance check
main();