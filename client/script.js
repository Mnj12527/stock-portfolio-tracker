document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const signUpForm = document.getElementById("signUpForm");
    const signupBtn = document.getElementById("signupBtn");
    const signinBtn = document.getElementById("signinBtn");
    const passwordInput = document.getElementById("password");
    const togglePassword = document.querySelector(".toggle-password");

    // Initially hide the sign-up form
    signUpForm.style.display = "none";

    // Show sign-up form when clicking "Sign Up"
    signupBtn.addEventListener("click", function () {
        signUpForm.style.display = "block";
        loginForm.style.display = "none";
        signupBtn.classList.add("active");
        signinBtn.classList.remove("active");
    });

    // Show sign-in form when clicking "Sign In"
    signinBtn.addEventListener("click", function () {
        loginForm.style.display = "block";
        signUpForm.style.display = "none";
        signinBtn.classList.add("active");
        signupBtn.classList.remove("active");
    });

    // Toggle password visibility
    togglePassword.addEventListener("click", function () {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
        } else {
            passwordInput.type = "password";
        }
    });

    // Handle login form submission
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

    // Handle sign-up form submission
    signUpForm.addEventListener("submit", function (event) {
        event.preventDefault(); // Prevent page reload

        let fullName = document.getElementById("fullName").value;
        let mobile = document.getElementById("mobile").value;
        let email = document.getElementById("email").value;
        let password = document.getElementById("password").value;

        // Instead of displaying the details, send them to the backend (if needed)
        fetch("http://localhost:5000/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ fullName, mobile, email, password }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert("Sign-up successful! Please log in.");
                signUpForm.reset(); // Clear the form after successful submission
                signinBtn.click(); // Switch to the sign-in form after signing up
            } else {
                alert("Sign-up failed: " + data.message);
            }
        })
        .catch(error => console.error("Error:", error));
    });
});
