FROM nginx:latest

# Add random index.html
RUN echo "<html><body><h1>Sample app!</h1></body></html>" > /usr/share/nginx/html/index.html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]