import { Controller, Get, Delete, Body } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserDeletionService } from './user-deletion.service';

@ApiTags('Public User Deletion')
@Controller('app/users')
export class UserDeletionController {
  constructor(private readonly userDeletionService: UserDeletionService) {}

  @ApiResponse({ description: 'Delete user account by email and password' })
  @Delete('delete-users')
  async deleteUserByEmailPassword(
    @Body() body: { email: string; password: string },
  ) {
    try {
      const result = await this.userDeletionService.deleteUserByEmailPassword(
        body.email,
        body.password,
      );
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('delete-account')
  deleteAccountPage() {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delete Account - C.D.C.G</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
 
         body {
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             background: linear-gradient(135deg, #0C4A6E 0%, #0EA5E9 50%, #7DD3FC 100%);
             min-height: 100vh;
             display: flex;
             align-items: center;
             justify-content: center;
             padding: 20px;
             position: relative;
             overflow: hidden;
         }
 
        .background-elements {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
        }
 
         .paper-plane {
             position: absolute;
             color: rgba(125, 211, 252, 0.1);
             font-size: 60px;
             animation: float 8s ease-in-out infinite;
         }
 
        .paper-plane:nth-child(1) {
            top: 15%;
            left: 10%;
            animation-delay: 0s;
            transform: rotate(-15deg);
        }
 
        .paper-plane:nth-child(2) {
            top: 60%;
            right: 15%;
            animation-delay: 3s;
            transform: rotate(25deg);
        }
 
        .paper-plane:nth-child(3) {
            bottom: 20%;
            left: 20%;
            animation-delay: 6s;
            transform: rotate(-30deg);
        }
 
        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(var(--rotate, 0deg)); }
            33% { transform: translateY(-15px) rotate(calc(var(--rotate, 0deg) + 5deg)); }
            66% { transform: translateY(-10px) rotate(calc(var(--rotate, 0deg) - 3deg)); }
        }
 
         .container {
             background: rgba(255, 255, 255, 0.95);
             backdrop-filter: blur(20px);
             border-radius: 24px;
             padding: 48px 40px;
             max-width: 420px;
             width: 100%;
             box-shadow:
                 0 25px 50px rgba(0, 0, 0, 0.3),
                 0 0 0 1px rgba(125, 211, 252, 0.2),
                 inset 0 1px 0 rgba(255, 255, 255, 0.1);
             border: 1px solid rgba(125, 211, 252, 0.3);
             transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
             position: relative;
             z-index: 10;
         }
 
        .container:hover {
            transform: translateY(-4px);
            box-shadow:
                0 35px 70px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(125, 211, 252, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
 
        .header {
            text-align: center;
            margin-bottom: 32px;
        }
 
         .logo-container {
             width: 80px;
             height: 80px;
             margin: 0 auto 24px;
             background: linear-gradient(135deg, #7DD3FC 0%, #0EA5E9 100%);
             border-radius: 20px;
             display: flex;
             align-items: center;
             justify-content: center;
             box-shadow: 0 8px 25px rgba(125, 211, 252, 0.3);
             animation: pulse 3s infinite;
         }
 
        .logo {
            width: 50px;
            height: 50px;
            color: white;
            font-size: 24px;
            font-weight: bold;
        }
 
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 8px 25px rgba(125, 211, 252, 0.3); }
            50% { transform: scale(1.05); box-shadow: 0 12px 35px rgba(125, 211, 252, 0.4); }
        }
 
         h2 {
             font-size: 28px;
             font-weight: 700;
             color: #0C4A6E;
             margin-bottom: 8px;
             letter-spacing: -0.025em;
         }
 
        .subtitle {
            color: rgba(12, 74, 110, 0.7);
            font-size: 16px;
            line-height: 1.5;
        }
 
        .form-group {
            margin-bottom: 24px;
            position: relative;
        }
 
         label {
             display: block;
             font-weight: 600;
             color: rgba(12, 74, 110, 0.9);
             margin-bottom: 8px;
             font-size: 14px;
             letter-spacing: 0.025em;
         }
 
          input[type="email"], input[type="password"] {
              width: 100%;
              padding: 16px 20px;
              border: 2px solid rgba(125, 211, 252, 0.4);
              border-radius: 12px;
              font-size: 16px;
              background: rgba(255, 255, 255, 0.9);
              color: #0C4A6E;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              outline: none;
          }
 
        input[type="email"]::placeholder, input[type="password"]::placeholder {
            color: rgba(12, 74, 110, 0.5);
        }
 
          input[type="email"]:focus, input[type="password"]:focus {
              border-color: #0EA5E9;
              box-shadow: 0 0 0 4px rgba(125, 211, 252, 0.25);
              transform: translateY(-1px);
              background: rgba(255, 255, 255, 1);
          }
 
        input[type="email"]:hover, input[type="password"]:hover {
            border-color: rgba(125, 211, 252, 0.6);
        }
 
        .delete-button {
            width: 100%;
            padding: 16px 24px;
            background: linear-gradient(135deg, #E74C3C, #C0392B);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            letter-spacing: 0.025em;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 25px rgba(231, 76, 60, 0.3);
        }
 
        .delete-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }
 
        .delete-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(231, 76, 60, 0.4);
            background: linear-gradient(135deg, #EC7063, #D5392A);
        }
 
        .delete-button:hover::before {
            left: 100%;
        }
 
        .delete-button:active {
            transform: translateY(0);
        }
 
        .delete-button:disabled {
            background: rgba(255, 255, 255, 0.1);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
 
        .warning-text {
            text-align: center;
            color: #FF6B6B;
            font-size: 14px;
            font-weight: 500;
            margin-top: 20px;
            padding: 16px;
            background: rgba(231, 76, 60, 0.1);
            border-radius: 12px;
            border-left: 4px solid #E74C3C;
            backdrop-filter: blur(10px);
        }
 
         .loading {
             position: absolute;
             top: 0;
             left: 0;
             width: 100%;
             height: 100%;
             background: rgba(255, 255, 255, 0.98);
             backdrop-filter: blur(10px);
             border-radius: 24px;
             display: none;
             align-items: center;
             justify-content: center;
             flex-direction: column;
         }
 
         .spinner {
             width: 48px;
             height: 48px;
             border: 4px solid rgba(125, 211, 252, 0.2);
             border-top: 4px solid #0EA5E9;
             border-radius: 50%;
             animation: spin 1s linear infinite;
         }
 
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
 
         .loading-text {
             margin-top: 20px;
             font-size: 16px;
             font-weight: 500;
             color: rgba(12, 74, 110, 0.9);
         }
 
        .brand-text {
            text-align: center;
            margin-top: 24px;
            color: rgba(12, 74, 110, 0.6);
            font-size: 14px;
            font-weight: 500;
        }
 
        @media (max-width: 480px) {
            .container {
                padding: 32px 24px;
                margin: 16px;
            }
           
            h2 {
                font-size: 24px;
            }
           
            .logo-container {
                width: 70px;
                height: 70px;
            }
           
            .logo {
                width: 40px;
                height: 40px;
            }
        }
    </style>
</head>
<body>
    <div class="background-elements">
        <div class="paper-plane" style="--rotate: -15deg;">✈️</div>
        <div class="paper-plane" style="--rotate: 25deg;">✈️</div>
        <div class="paper-plane" style="--rotate: -30deg;">✈️</div>
    </div>
 
    <div class="container">
        <div class="header">
            <div class="logo-container">
                 <div class="logo">C.D.C.G</div>
            </div>
            <h2>Delete Account</h2>
            <p class="subtitle">Permanently delete your account and all data</p>
        </div>
 
        <form id="deleteForm">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" placeholder="Enter your email address" required>
            </div>
 
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter your password" required>
            </div>
 
            <button type="submit" class="delete-button">Delete My Account</button>
        </form>
 
        <div class="warning-text">
            ⚠️ Your account and all data will be permanently deleted.
        </div>
 
        <div class="brand-text">
            C.D.C.G - PROJECT MANAGEMENT
        </div>
 
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <div class="loading-text">Deleting your account...</div>
        </div>
    </div>
 
    <script>
        document.getElementById('deleteForm').addEventListener('submit', function(event) {
            event.preventDefault();
 
            const loadingElement = document.getElementById('loading');
            const submitButton = document.querySelector('.delete-button');
           
            // Show loading state
            loadingElement.style.display = 'flex';
            submitButton.disabled = true;
 
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;


            fetch('https://server.cdcg.pt/api/app/users/delete-users', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                }),
            })
            .then(response => {
                console.log('Response status:', response.status);
                console.log('Response ok:', response.ok);
                return response.json();
            })
            .then(data => {
                console.log('Response data:', data);
                // Hide loading state
                loadingElement.style.display = 'none';
                submitButton.disabled = false;
 
                if (data.success) {
                    // Success animation
                    document.querySelector('.container').style.transform = 'scale(0.95)';
                    document.querySelector('.container').style.opacity = '0.8';
                   
                    setTimeout(() => {
                        alert('✅ Your account has been successfully deleted.');
                    }, 300);
                } else {
                    alert('❌ Error deleting account: ' + data.message);
                }
            })
            .catch(error => {
                // Hide loading state
                loadingElement.style.display = 'none';
                submitButton.disabled = false;
               
                console.error('Fetch error:', error);
                console.error('Error message:', error.message);
                alert('❌ Network error: ' + error.message + '. Please check if the server is running on port 4000.');
            });
        });
 
        // Add input animation effects
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.parentElement.style.transform = 'translateY(-2px)';
            });
           
            input.addEventListener('blur', function() {
                this.parentElement.style.transform = 'translateY(0)';
            });
        });
    </script>
</body>
</html>`;

    return html;
  }
}
