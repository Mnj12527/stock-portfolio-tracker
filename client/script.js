document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const signUpForm = document.getElementById("signUpForm");
    const signupBtn = document.getElementById("signupBtn");
    const signinBtn = document.getElementById("signinBtn");
    const outputElement = document.getElementById("output"); // Get the output element for messages

    // Initially hide the sign-up form
    signUpForm.style.display = "none";

    // Switch to Sign-Up Form
    signupBtn.addEventListener("click", function () {
        signUpForm.style.display = "block";
        loginForm.style.display = "none";
        signupBtn.classList.add("active");
        signinBtn.classList.remove("active");
        outputElement.textContent = ""; // Clear messages on tab switch
    });

    // Switch to Sign-In Form
    signinBtn.addEventListener("click", function () {
        loginForm.style.display = "block";
        signUpForm.style.display = "none";
        signinBtn.classList.add("active");
        signupBtn.classList.remove("active");
        outputElement.textContent = ""; // Clear messages on tab switch
    });

    // Handle Login
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("signin-email").value;
        const password = document.getElementById("signin-password").value;

        try {
            const response = await fetch("http://localhost:5000/signin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) { // Check for a successful HTTP status (e.g., 200 OK)
                if (data.token && data.username && data.role) { // Ensure token, username, and role are in the response
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("username", data.username);
                    localStorage.setItem("userRole", data.role); // Store the user's role
                    outputElement.textContent = data.message || "Sign in successful!";
                    outputElement.style.color = "green";

                    if (data.role === 'admin') {
                        window.location.replace("/admin.html"); // Redirect to admin page for admins
                    } else {
                        window.location.replace("/Home.html"); // Redirect to home page for regular users
                    }
                } else {
                    // This scenario should ideally not happen if server is working correctly
                    outputElement.textContent = data.message || 'Login successful, but username, token, or role missing from response.';
                    outputElement.style.color = 'orange';
                    console.error('Missing token, username, or role in server response:', data);
                }
            } else {
                // Handle non-200 responses (e.g., 401 Unauthorized, 404 Not Found)
                outputElement.textContent = data.message || 'Login failed. Please check your credentials.';
                outputElement.style.color = 'red';
            }
        } catch (error) {
            console.error('Error during sign-in:', error);
            outputElement.textContent = 'An error occurred during login. Please try again later.';
            outputElement.style.color = 'red';
        }
    });

    // Handle Sign-Up
    signUpForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username = document.getElementById("signup-fullName").value;
        const email = document.getElementById("signup-email").value;
        const password = document.getElementById("signup-password").value;

        try {
            const response = await fetch("http://localhost:5000/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) { // Use response.ok for proper HTTP status check
                alert("Sign-up successful! Please log in.");
                signUpForm.reset();
                signinBtn.click(); // Switch to login
            } else {
                alert("Sign-up failed: " + (data.message || "Unknown error"));
                console.error("Sign-up error:", data);
            }
        } catch (error) {
            console.error('Error during sign-up:', error);
            alert('An error occurred during sign-up. Please try again later.');
        }
    });

    // Add listener for "Go to Dashboard" button (if it exists on the page)
    const goToHomeBtn = document.getElementById("goToHomeBtn");
    if (goToHomeBtn) {
        goToHomeBtn.addEventListener("click", function() {
            window.location.replace("/Home.html");
        });
    }

});

// IMPORTANT: Ensure this signOut function is present and consistent across all relevant files
function signOut() {
    localStorage.removeItem("token"); // Clear the authentication token
    localStorage.removeItem("username"); // Clear the username
    localStorage.removeItem("userRole"); // Clear the user's role
    // Redirect to login page and replace the current history entry
    window.location.replace("index.html");
}

const apiKey = '5b9dc55198084f319b1bb3d2e8ffb8dc'; // Replace with your real key
const newsList = document.getElementById('news-list'); // This element might only exist in News.html now

async function fetchNews() {
    // Ensure newsList element exists before trying to manipulate it
    if (!newsList) {
        console.warn("news-list element not found. This function might be called from a page without the news list.");
        return;
    }

    try {
        const response = await fetch(`https://newsapi.org/v2/top-headlines?country=in&pageSize=10&apiKey=${apiKey}`);
        const data = await response.json();

        if (data.articles && data.articles.length > 0) {
            newsList.innerHTML = ''; // Clear previous content
            data.articles.forEach(article => {
                const item = document.createElement('div');
                item.className = 'news-item';

                item.innerHTML = `
                    <img src="${article.urlToImage || 'https://via.placeholder.com/120x80'}" alt="news image" />
                    <div class="content">
                        <h3><a href="${article.url}" target="_blank">${article.title}</a></h3>
                        <p>${article.description || ''}</p>
                    </div>
                `;
                newsList.appendChild(item);
            });
        } else {
            newsList.innerHTML = '<p>No news articles found.</p>';
        }
    } catch (error) {
        console.error('Error fetching news:', error);
        newsList.innerHTML = '<p>Failed to load news.</p>';
    }
}