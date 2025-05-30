// analysis.js

function renderWatchlistPieChart() {
  const token = localStorage.getItem("token");

  fetch("/api/watchlist-counts", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.counts && data.counts.length === 3) {
      const ctx = document.getElementById("watchlistPieChart").getContext("2d");

      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Watchlist 1', 'Watchlist 2', 'Watchlist 3'],
          datasets: [{
            label: 'Stock Count',
            data: data.counts,
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            },
            title: {
              display: true,
              text: 'Stock Count per Watchlist'
            }
          }
        }
      });
    } else {
      console.warn("Unexpected data format from server:", data);
    }
  })
  .catch(err => {
    console.error("Error fetching watchlist pie chart data:", err);
  });
}
