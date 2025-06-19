require('dotenv').config();
const fs = require('fs');
const { createIrys } = require('@irys/sdk');

async function main() {
  const irys = await createIrys({
    network: 'devnet',
    token: 'irys',
    key: process.env.PRIVATE_KEY,
  });

  const filePath = '/Users/g/Downloads/IMG_3269.mov';
  const data = fs.readFileSync(filePath);

  const cost = await irys.getPrice(data.length);
  console.log(`💰 Upload cost: ${irys.utils.fromAtomic(cost)} IRYS`);
}

main().catch(console.error);
