// Check if watchlists is already defined in the global window scope to avoid redeclaration
if (typeof window.watchlists === "undefined") {
    window.watchlists = [[], [], []]; // Initialize watchlists only if it's not defined
  }
  
  if (typeof window.currentWatchlist === "undefined") {
    window.currentWatchlist = 0; // Initialize currentWatchlist only if it's not defined
  }
  
  // Fetch and render watchlists on load
  window.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
  
    try {
      const response = await fetch("http://localhost:5000/watchlists", {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      const data = await response.json();
      if (data.watchlists) {
        window.watchlists = data.watchlists;  // Update global watchlists
        renderWatchlist(); // <-- Make sure this is called!
        highlightActiveButton(window.currentWatchlist);
      } else {
        console.error("No watchlists found in response");
      }
    } catch (err) {
      console.error("Error fetching watchlists:", err);
    }
  });
  
  function switchWatchlist(index) {
    window.currentWatchlist = index;
    renderWatchlist();
    highlightActiveButton(index);
  }
  
  function addStock() {
    const input = document.getElementById("stockInput");
    const symbol = input.value.trim().toUpperCase();
    if (symbol && !window.watchlists[window.currentWatchlist].includes(symbol)) {
      window.watchlists[window.currentWatchlist].push(symbol);
      renderWatchlist();
      saveWatchlists();
    }
    input.value = "";
  }
  
  function renderWatchlist() {
    const list = document.getElementById("watchlistDisplay");
    list.innerHTML = "";
    window.watchlists[window.currentWatchlist].forEach((stock, index) => {
      const li = document.createElement("li");
      const stockName = document.createElement("span");
      stockName.textContent = stock;
  
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "−";
      removeBtn.onclick = () => {
        window.watchlists[window.currentWatchlist].splice(index, 1);
        renderWatchlist();
        saveWatchlists();
      };
  
      li.appendChild(stockName);
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  }
  
  function saveWatchlists() {
    const token = localStorage.getItem("token");
    fetch("http://localhost:5000/watchlists", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ watchlists: window.watchlists })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        console.error("Error saving watchlists", data);
      } else {
        console.log("Watchlists saved:", data);
      }
    });
  }
  
  function highlightActiveButton(index) {
    document.querySelectorAll(".watchlist-tabs button").forEach((btn, i) => {
      btn.style.backgroundColor = i === index ? "#333" : "#6f2cff";
    });
  }
  