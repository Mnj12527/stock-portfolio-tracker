document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const passwordInput = document.getElementById("password");
    const togglePassword = document.querySelector(".toggle-password");

    // Toggle password visibility
    togglePassword.addEventListener("click", function () {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
        } else {
            passwordInput.type = "password";
        }
    });

    // Handle form submission
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
    
        const email = document.getElementById("email").value;
        const password = passwordInput.value;
    
        const response = await fetch("http://localhost:5000/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });
    
        const data = await response.json();
        if (response.ok) {
            alert("Login successful!");
            window.location.href = "dashboard.html";
        } else {
            alert(data.message);
        }
    });
});