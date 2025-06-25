// Ensure these are globally accessible for initProfilePage to use
// They will be defined in home.html
// const API_BASE_URL = 'http://localhost:5000';
// let authToken = localStorage.getItem('token'); // Always re-get token in dynamically loaded scripts

let profileForm;
let changePasswordForm;
let profileMessage;
let passwordMessage;

/**
 * Function to display messages in the UI.
 * @param {HTMLElement} element - The HTML element where the message should be displayed.
 * @param {string} message - The message text.
 * @param {boolean} isSuccess - True for a success message, false for an error message.
 */
function showMessage(element, message, isSuccess) {
    if (!element) {
        console.error("showMessage: Element not found.");
        return;
    }
    element.textContent = message;
    element.className = 'message'; // Reset class
    if (isSuccess) {
        element.classList.add('success');
    } else {
        element.classList.add('error');
    }
    element.style.display = 'block'; // Ensure it's visible

    // Clear message after a few seconds
    setTimeout(() => {
        element.textContent = '';
        element.classList.remove('success', 'error');
        element.style.display = 'none'; // Hide it again
    }, 5000);
}

/**
 * Fetches user profile data and populates the form fields.
 */
async function fetchUserProfile() {
    if (!window.authToken) {
        showMessage(profileMessage, 'Please log in to view your profile.', false);
        return;
    }

    try {
        const response = await fetch(`${window.API_BASE_URL}/profile`, {
            headers: {
                'Authorization': `Bearer ${window.authToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch profile: HTTP status ${response.status}`);
        }

        const userData = await response.json();
        
        // Populate form fields
        if (document.getElementById('username')) document.getElementById('username').value = userData.username || '';
        if (document.getElementById('email')) document.getElementById('email').value = userData.email || '';
        if (document.getElementById('mobileNumber')) document.getElementById('mobileNumber').value = userData.mobileNumber || '';
        if (document.getElementById('address')) document.getElementById('address').value = userData.address || '';
        if (document.getElementById('profession')) document.getElementById('profession').value = userData.profession || '';

    } catch (error) {
        console.error('Error fetching user profile:', error);
        showMessage(profileMessage, `Failed to load profile: ${error.message}`, false);
    }
}

/**
 * Handles the submission of the profile update form.
 * @param {Event} event - The form submission event.
 */
async function handleProfileSubmit(event) {
    event.preventDefault();

    if (!window.authToken) {
        showMessage(profileMessage, 'Please log in to update your profile.', false);
        return;
    }

    const updatedProfile = {
        username: document.getElementById('username').value,
        mobileNumber: document.getElementById('mobileNumber').value,
        address: document.getElementById('address').value,
        profession: document.getElementById('profession').value
    };

    try {
        const response = await fetch(`${window.API_BASE_URL}/profile/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authToken}`
            },
            body: JSON.stringify(updatedProfile)
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(profileMessage, data.message || 'Profile updated successfully!', true);
        } else {
            showMessage(profileMessage, data.message || 'Failed to update profile.', false);
        }
    } catch (error) {
        console.error('profileForm submit - Error updating profile:', error);
        showMessage(profileMessage, 'Network error or server unavailable when updating profile.', false);
    }
}

/**
 * Handles the submission of the change password form.
 * @param {Event} event - The form submission event.
 */
async function handleChangePasswordSubmit(event) {
    event.preventDefault();

    if (!window.authToken) {
        showMessage(passwordMessage, 'Please log in to change your password.', false);
        return;
    }

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
        showMessage(passwordMessage, 'New password and confirm new password do not match.', false);
        return;
    }

    try {
        const response = await fetch(`${window.API_BASE_URL}/profile/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authToken}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(passwordMessage, data.message || 'Password changed successfully!', true);
            changePasswordForm.reset(); // Clear the form
        } else {
            showMessage(passwordMessage, data.message || 'Failed to change password.', false);
        }
    } catch (error) {
        console.error('changePasswordForm submit - Error changing password:', error);
        showMessage(passwordMessage, 'Network error or server unavailable when changing password.', false);
    }
}

/**
 * Initializes the profile page by setting up event listeners and fetching data.
 * This function is called by home.html after profile.html content is loaded.
 */
function initProfilePage() {
    console.log("initProfilePage called.");
    // Get element references AFTER the HTML is loaded into the DOM
    profileForm = document.getElementById('profileForm');
    changePasswordForm = document.getElementById('changePasswordForm');
    profileMessage = document.getElementById('profileMessage');
    passwordMessage = document.getElementById('passwordMessage');

    // Attach event listeners only once
    if (profileForm && !profileForm.__eventListenerAttached) {
        profileForm.addEventListener('submit', handleProfileSubmit);
        profileForm.__eventListenerAttached = true;
    }
    if (changePasswordForm && !changePasswordForm.__eventListenerAttached) {
        changePasswordForm.addEventListener('submit', handleChangePasswordSubmit);
        changePasswordForm.__eventListenerAttached = true;
    }

    fetchUserProfile(); // Initial fetch
}

// Expose initProfilePage globally so home.html can call it
window.initProfilePage = initProfilePage;