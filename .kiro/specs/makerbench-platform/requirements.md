# Requirements Document

## Introduction

Makerbench is a developer tool discovery platform that allows developers to submit and discover web-based tools through URL submission with tagging capabilities. The platform goes beyond simple bookmarking by enabling tag-based search functionality, making it easy for developers to find tools they've used before or discover new ones in specific categories. The system includes automated metadata extraction, screenshot generation, and an admin review process to ensure quality.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to search for tools by name or tags, so that I can quickly find relevant development tools even when I don't remember the exact name.

#### Acceptance Criteria

1. WHEN a user enters a search term THEN the system SHALL return tools matching the name, description, or associated tags
2. WHEN a user searches for "repl" THEN the system SHALL return all tools tagged with "repl"
3. WHEN a user searches for multiple terms like "open source design" THEN the system SHALL return tools that match both "design" and "open source" tags
4. WHEN no search results are found THEN the system SHALL display an appropriate "no results" message
5. WHEN the search field is empty THEN the system SHALL display all approved tools

### Requirement 2

**User Story:** As a developer, I want to view tool information in an organized grid layout, so that I can quickly scan and evaluate multiple tools at once.

#### Acceptance Criteria

1. WHEN viewing the main page THEN the system SHALL display tools in a responsive grid layout
2. WHEN displaying a tool card THEN the system SHALL show the tool's screenshot/image, title, description, tags, and website link
3. IF a GitHub repository URL was provided THEN the system SHALL display a link to the repository
4. IF the submitter provided their information THEN the system SHALL display the submitter's name and GitHub profile link
5. WHEN a user clicks a tool's website link THEN the system SHALL open the tool's website in a new tab
6. WHEN a user clicks a GitHub link THEN the system SHALL open the repository in a new tab

### Requirement 3

**User Story:** As a developer, I want to suggest new tools to the platform, so that I can contribute useful resources to the developer community.

#### Acceptance Criteria

1. WHEN a user clicks "suggest a tool" button THEN the system SHALL display a submission form between the search field and tool grid
2. WHEN submitting a tool THEN the system SHALL require a tool website URL
3. WHEN submitting a tool THEN the system SHALL require a a list of one or more tags as a comma separated list
4. WHEN submitting a tool THEN the system SHALL allow optional GitHub repository URL, submitter name, and submitter GitHub URL
5. WHEN the form is submitted with valid data THEN the system SHALL process the submission via Netlify function
6. WHEN form submission is successful THEN the system SHALL hide the form and show a success message
7. WHEN form submission fails THEN the system SHALL display appropriate error messages

### Requirement 4

**User Story:** As a system administrator, I want submitted tools to be automatically processed for metadata, so that the platform maintains consistent and rich tool information.

#### Acceptance Criteria

1. WHEN a tool URL is submitted THEN the system SHALL attempt to extract title, description, and image from page metadata
2. WHEN extracting metadata THEN the system SHALL check standard meta tags and Open Graph tags (og:title, og:image, og:description)
3. IF no image is found in metadata THEN the system SHALL use Browserless API to capture a screenshot
4. WHEN a screenshot is captured THEN the system SHALL store the image file in an S3 bucket
5. WHEN metadata extraction is complete THEN the system SHALL store all tool data in the Turso SQLite database
6. WHEN a new tool is stored THEN the system SHALL set the in_review property to true

### Requirement 5

**User Story:** As a system administrator, I want to review submitted tools before they appear publicly, so that I can ensure quality and appropriateness of content.

#### Acceptance Criteria

1. WHEN a tool is initially submitted THEN the system SHALL set in_review to true
2. WHEN in_review is true THEN the system SHALL NOT display the tool on the public website
3. WHEN a new tool is submitted THEN the system SHALL send an email notification to the configured admin email address
4. WHEN an admin approves a tool THEN the system SHALL set in_review to false
5. WHEN in_review is false THEN the system SHALL display the tool in search results and the main grid

### Requirement 6

**User Story:** As a user with accessibility needs, I want the platform to be fully accessible, so that I can use all features regardless of my abilities.

#### Acceptance Criteria

1. WHEN using screen readers THEN the system SHALL provide appropriate ARIA labels and semantic HTML
2. WHEN navigating with keyboard only THEN the system SHALL provide visible focus indicators and logical tab order
3. WHEN viewing content THEN the system SHALL meet WCAG 2.1 AA color contrast requirements
4. WHEN images are displayed THEN the system SHALL provide meaningful alternative text unless the image is purely decorative
5. WHEN forms are presented THEN the system SHALL associate labels with form controls and provide clear error messages

### Requirement 7

**User Story:** As a user on any device, I want the platform to be performant and responsive, so that I can efficiently discover tools regardless of my device or connection speed.

#### Acceptance Criteria

1. WHEN accessing the site on mobile devices THEN the system SHALL display a responsive layout optimized for small screens
2. WHEN loading the main page THEN the system SHALL achieve Core Web Vitals performance benchmarks
3. WHEN images are loaded THEN the system SHALL implement lazy loading for tool screenshots
4. WHEN the site loads THEN the system SHALL minimize initial bundle size and implement code splitting where appropriate
5. WHEN using the search functionality THEN the system SHALL provide immediate feedback and debounced search requests

### Requirement 8

**User Story:** As a developer maintaining the platform, I want a clean CSS architecture without framework dependencies, so that the codebase remains maintainable and performant.

#### Acceptance Criteria

1. WHEN styling components THEN the system SHALL use CSS custom properties for design tokens
2. WHEN implementing the design system THEN the system SHALL NOT use Tailwind or other CSS frameworks
3. WHEN creating reusable styles THEN the system SHALL define standardized component classes
4. WHEN organizing CSS THEN the system SHALL maintain a clear design system with consistent spacing, typography, and color schemes
5. WHEN building for production THEN the system SHALL optimize CSS delivery and minimize unused styles
