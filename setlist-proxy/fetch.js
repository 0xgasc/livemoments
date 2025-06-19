// fetchStream.js
import Query from "@irys/query";

async function fetchTxStream(wallet, limit = 50) {
  const q = new Query({ network: "devnet" });
  let count = 0;

  for await (const tx of await q
    .search("irys:transactions")
    .from([wallet])
    .sort("DESC")
    .stream()) {
    
    console.log(tx);
    if (++count >= limit) break;
  }
}

fetchTxStream("0x23de198f1520ad386565fc98aee6abb3ae5052be", 50)
  .catch(console.error);
