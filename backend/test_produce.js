(async ()=>{
  try{
    const res = await fetch('http://localhost:10000/api/produce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pizza: 'pizza1', quantity: 1 })
    });
    const data = await res.json();
    console.log('STATUS', res.status);
    console.log(JSON.stringify(data, null, 2));
  }catch(err){
    console.error(err);
  }
})();
