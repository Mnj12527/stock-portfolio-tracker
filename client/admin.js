document.getElementById("startBtn").addEventListener("click", () => {
    alert("Welcome to the Admin Dashboard!");
});

// NEWLY ADDED JAVASCRIPT FOR THE 'Go to User Dashboard' BUTTON
document.getElementById("goToHomePageBtn").addEventListener("click", () => {
    window.location.href = "Home.html"; // Redirects to your Home page
});

const transactions = [
    "TXN123456 - ₹4500 - Completed",
    "TXN123457 - ₹1500 - Pending",
    "TXN123458 - ₹8000 - Completed",
    "TXN123459 - ₹2200 - Failed",
    "TXN123460 - ₹3000 - Completed"
];

const transactionList = document.getElementById("transactionList");

transactions.forEach(txn => {
    const li = document.createElement("li");
    li.textContent = txn;
    transactionList.appendChild(li);
});