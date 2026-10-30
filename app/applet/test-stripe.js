const fs = require('fs');

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: "pro",
        plan: "yearly",
        paymentMethod: "card"
      }),
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
