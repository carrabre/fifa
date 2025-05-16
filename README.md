# Founders Inc FIFA Tracker

A modern web application for tracking FIFA matches between colleagues at Founders Inc. Built with Next.js and Thirdweb for Web3 integration, the app provides a sleek, professional interface for recording match results, viewing statistics, and competing on the leaderboard.

![Founders Inc FIFA Tracker](/public/favicon.svg)

## Features

### User Authentication
- Secure wallet-based authentication using Thirdweb
- Personalized profiles with customizable display names
- Seamless session management across browser sessions

### Match Management
- Record match results with scores and team selections
- Track performance across all matches
- View win/loss/draw statistics and goal metrics
- Delete matches with automatic stat recalculation
- Win/loss celebration screens with confetti effects

### Statistics & Leaderboard
- Real-time leaderboard with rankings
- Detailed player statistics (wins, losses, draws, goals)
- Consistent stat tracking across the application
- Performance visualizations and win percentage calculations

### UI/UX
- Modern, dark-themed design inspired by EA FC24
- Responsive layout for all screen sizes
- Interactive components with hover states and transitions
- Branded with Founders Inc colors and styling

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Data Management

The application uses Supabase for data persistence with the following tables:
- `users` - Stores user profiles with wallet addresses and display names
- `matches` - Records all match data including scores and teams
- `player_stats` - Maintains player statistics with real-time calculation

## Usage Guide

1. **Connect Wallet**: Start by connecting your wallet on the homepage
2. **Create Profile**: Set your display name for others to recognize you
3. **Record Matches**: Enter match results against opponents
4. **View Stats**: Check your performance on the dashboard
5. **Leaderboard**: See how you rank against colleagues
6. **Match History**: View detailed match records and optionally delete matches

## Technology Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Authentication**: Thirdweb for wallet connections
- **Database**: Supabase for persistent storage
- **State Management**: React hooks for local state

## License

This project is licensed under the MIT License.

## Built By

Developed for Founders Inc to promote friendly competition and track FIFA match results.

## Learn More

To learn more about thirdweb, take a look at the following resources:

- [thirdweb Auth Documentation](https://docs.thirdweb.com/auth) - learn about thirdweb Auth.
- [thirdweb React Documentation](https://docs.thirdweb.com/react) - learn about our React SDK.
- [thirdweb Portal](https://docs.thirdweb.com) - check our guides and development resources.

You can check out [the thirdweb GitHub organization](https://github.com/thirdweb-dev) - your feedback and contributions are welcome!

## Join our Discord!

For any questions, suggestions, join our discord at [https://discord.gg/thirdweb](https://discord.gg/thirdweb).
