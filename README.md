# Weather MiniApp 🌤️

A Farcaster-integrated Weather MiniApp for real-time conditions, local forecasts, and adaptive greetings!

---

## Features

- **Live weather updates**: Current temperature, humidity, wind speed, and "feels like" info powered by OpenWeatherMap API
- **Location detection**: Auto-fetches weather for user's city using geolocation
- **Adaptive greeting**: Custom greeting based on user local time (morning, afternoon, evening)
- **Error handling**: Robust error handling for API failures, network issues, and location permission denials
- **API integration**: Seamless integration with OpenWeatherMap API for accurate weather data
- **Farcaster integration**: Optimized for Farcaster mini-app ecosystem using Frame SDK
- **Responsive UI**: Simple, clean, mobile-friendly HTML layout with gradient background and weather icons

---

## Getting Started

### Prerequisites

- OpenWeatherMap API key (sign up at [OpenWeatherMap](https://openweathermap.org/api))

### Configuration

1. Clone the repository:
   ```bash
   git clone https://github.com/CryptoExplor/weather-mini-app.git
   ```

2. Open `index.html` in your favorite code editor

3. Add your OpenWeatherMap API key:
   - Locate the API key configuration section in `index.html`
   - Replace `YOUR_API_KEY_HERE` with your actual OpenWeatherMap API key:
     ```javascript
     const API_KEY = 'your_openweathermap_api_key';
     ```

4. Open `index.html` in your browser to use the app. No build required!

### Repository Files

- `index.html`: Main frontend code for weather display and logic
- `.well-known/farcaster.json`: App manifest/config for Farcaster mini-app compatibility
- `vercel.json`: Deployment config for Vercel hosting
- `LICENSE`: Project license (MIT)
- `icon.png`, `favicon.ico`, `image.png`, `splash.png`: App icons and images

---

## UI Details

### Visual Design

- **Gradient Background**: Dynamic gradient background that creates an immersive weather experience
- **Weather Icons**: Clear, intuitive weather icons representing different weather conditions (sunny, cloudy, rainy, etc.)
- **Card Layout**: Clean card-based layout displaying weather information in an organized, easy-to-read format
- **Responsive Design**: Adapts seamlessly to different screen sizes (mobile, tablet, desktop)
- **Typography**: Modern, readable fonts with clear hierarchy for different information types

---

## Usage

### Running Locally

1. Clone the repo:
   ```bash
   git clone https://github.com/CryptoExplor/weather-mini-app.git
   ```

2. Configure your OpenWeatherMap API key in `index.html`

3. Open `index.html` in your browser

4. Allow location access when prompted to get weather for your current location

5. View real-time weather information including:
   - Current temperature
   - "Feels like" temperature
   - Humidity percentage
   - Wind speed
   - Weather conditions

### Deployment

Or deploy instantly on [Vercel](https://weather-base-app.vercel.app/).

Simply connect your GitHub repository to Vercel and deploy with one click. Remember to add your OpenWeatherMap API key as an environment variable in your deployment settings.

---

## Tech Stack

- **HTML5**: Entire app logic in pure HTML/CSS/JS
- **Frame SDK**: Farcaster Frame SDK for seamless integration with the Farcaster ecosystem
- **OpenWeatherMap API**: Real-time weather data from OpenWeatherMap's comprehensive API
- **Farcaster**: MiniApp integration for Farcaster social/web3 platform
- **JavaScript**: Vanilla JavaScript for app logic and API interactions
- **CSS3**: Modern CSS for styling and responsive design

---

## License

MIT License
