# The backlog issues, labels and milestones used to be Terraform-managed (backlog.tf). They now live in GitHub only:
# `destroy = false` drops them from state without closing or deleting anything. This file can be deleted after the
# first apply on main.

removed {
  from = github_issue.story
  lifecycle {
    destroy = false
  }
}

removed {
  from = github_issue.epic
  lifecycle {
    destroy = false
  }
}

removed {
  from = github_issue_label.this
  lifecycle {
    destroy = false
  }
}

removed {
  from = github_repository_milestone.this
  lifecycle {
    destroy = false
  }
}
