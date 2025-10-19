Deployment quick steps

1. Create a new GitHub repo. Commit all files in this project into it under appropriate folders: `client/` and `server/`.
2. IMPORTANT: Before making any changes, tag this commit: `git tag -a v1.0.0 -m "Initial improved release"` and `git push --tags`.
3. Client: enable GitHub Pages to serve the `client` folder, or push client to Netlify.
4. Server: deploy the `server` folder to Render/Heroku. Provide environment variables from `.env.example`.
5. To deliver updates:
   - Make changes on a `dev` branch. When ready, create a release branch and tag it `v1.0.1`.
   - Keep old release zip files in `releases/` folder so they are never overwritten.

Security note: This server is minimal for demos. For production, add JWT authentication, rate limiting, input validation, and use a proper DB.