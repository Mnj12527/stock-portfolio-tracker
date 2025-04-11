document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const signUpForm = document.getElementById("signUpForm");
    const signupBtn = document.getElementById("signupBtn");
    const signinBtn = document.getElementById("signinBtn");
  
    // Initially hide the sign-up form
    signUpForm.style.display = "none";
  
    // Switch to Sign-Up Form
    signupBtn.addEventListener("click", function () {
      signUpForm.style.display = "block";
      loginForm.style.display = "none";
      signupBtn.classList.add("active");
      signinBtn.classList.remove("active");
    });
  
    // Switch to Sign-In Form
    signinBtn.addEventListener("click", function () {
      loginForm.style.display = "block";
      signUpForm.style.display = "none";
      signinBtn.classList.add("active");
      signupBtn.classList.remove("active");
    });
  
    // Handle Login
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
  
      const email = document.getElementById("signin-email").value;
      const password = document.getElementById("signin-password").value;
  
      const response = await fetch("http://localhost:5000/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
  
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        alert("Sign in successful!");
        window.location.href = "/portfolio.html"; // Redirect to portfolio
      } else {
        alert(data.message);
      }
    });
  
    // Handle Sign-Up
    signUpForm.addEventListener("submit", async function (event) {
      event.preventDefault();
  
      const username = document.getElementById("signup-fullName").value;
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;
  
      const response = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      });
  
      const data = await response.json();
      if (data.success) {
        alert("Sign-up successful! Please log in.");
        signUpForm.reset();
        signinBtn.click(); // Switch to login
      } else {
        alert("Sign-up failed: " + data.message);
      }
    });
  });
  