# CSE442 Fall 2025 No Brainers Group Project 
This repository contains the "Dorm Mart" web application, built with a React frontend and a PHP backend with XAMMP. 

Created for CSE-442: Software Engineering Concepts, The University at Buffalo.

# Dorm Mart: The Complete Student Marketplace
Dorm Mart is a student-to-student marketplace 
that makes it effortless to buy and sell campus 
essentials—textbooks, dorm gear, electronics, and 
more. Create listings in minutes, track interest 
and views, and manage sales from a clean, 
mobile-friendly dashboard. Built for safety and 
simplicity, Dorm Mart helps students save money, 
reduce waste, and find what they need fast—all 
within a familiar, school-centered community 
experience.

With instant messaging and a review system, students can communicate 
safely and build trust within their campus network. The platform 
supports everything from wishlists to scheduled purchases, 
making it easy to coordinate pickups and manage your entire selling 
workflow in one place!

## Key Features
- **Product Listings** - Create, edit, and view detailed product listings with images
- **Advanced Search** - Search with filters to find exactly what you're looking for
- **Real-time Chat** - Communicate instantly with buyers and sellers via WebSocket messaging
- **Seller Dashboard** - Manage your listings, track views, and monitor sales
- **Purchase History** - Keep track of your buying and selling transactions

# Development Team
- Sooseok Kim 
- Sameer Jain  
- Anish Banerjee

### Special Thank You To The CSE442 Course Staff:
- Matt Hertz
- Alan Hunt

**Key folders:**
- `dorm-mart/` — React app and PHP API
- `dorm-mart/api/` — PHP endpoints and DB utilities
- `dorm-mart/src/` — React source code
- `dorm-mart/public/` — static assets (favicons, manifest, index.html)

For local setup and deployment details, see `README.project_setup.md`.

## Tech Stack
**Frontend:** React, Tailwind CSS  
**Backend:** PHP 8+, MySQL  
**Auth:** PHP sessions + `password_hash` / `password_verify` (bcrypt)  
**Real-time:** WebSocket (Ratchet PHP library)  
**Dev Server:** XAMPP (Apache + MySQL)  

## Production Server
Check out the latest production release on UB Wifi: https://cattle.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/login



View the test server on UB Wifi: https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/login

## Quick Start
1. Clone the repository and navigate to the `dorm-mart` directory
2. Run `npm install` to install dependencies
3. Set up your local database (see `README.project_setup.md` for schema migration details)
4. Start the development server: `npm run start-local-win` (or `-mac`) and run `php -S localhost:8080 -t .` in the `dorm-mart` directory

For detailed setup instructions, deployment guides, and production build steps, see `README.project_setup.md`.