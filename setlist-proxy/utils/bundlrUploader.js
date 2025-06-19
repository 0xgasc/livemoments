require('dotenv').config();
const Bundlr = require('@bundlr-network/client').default;
const { JsonRpcProvider, Wallet, formatEther } = require('ethers');

async function getBundlr() {
  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

  const bundlr = new Bundlr(
    'https://node1.bundlr.network',
    'ethereum',
    wallet.privateKey,          // <-- pass private key string here
    { providerUrl: process.env.SEPOLIA_RPC }
  );

  await bundlr.ready();
  return bundlr;
}


async function estimateAndUpload(buffer, filename) {
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

  console.log(`🚀 Uploading ${filename}...`);
  const tx = await bundlr.upload(buffer, {
    tags: [
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'Filename', value: filename },
    ],
  });

  console.log('✅ Upload complete:', tx.id);
  return `https://arweave.net/${tx.id}`;
}

module.exports = { estimateAndUpload };
