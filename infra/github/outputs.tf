output "pages_url" {
  description = "GitHub Pages URL; it only redirects to https://vesper.dculus.com (web/github-pages/)."
  value       = github_repository_pages.this.html_url
}
