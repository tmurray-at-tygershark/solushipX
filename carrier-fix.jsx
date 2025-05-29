apiCredentials: {
                    ...formData.apiCredentials, // Preserve any existing apiCredentials FIRST
        accountNumber: formData.accountNumber,
            hostURL: formData.hostURL,
                username: formData.username,
                    password: formData.password,
                        secret: formData.secret,
                            endpoints: endpoints, // This will now override any existing endpoints
                }, 