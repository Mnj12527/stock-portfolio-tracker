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

        let output = `
            <h3>Sign-Up Details</h3>
            <p><strong>Full Name:</strong> ${fullName}</p>
            <p><strong>Mobile:</strong> ${mobile}</p>
            <p><strong>Email:</strong> ${email}</p>
        `;

        document.getElementById("output").innerHTML = output;
    });
});
