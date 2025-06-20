# Makerbench

The project will provide a URL input field as well as a plain text input field to the user.
This allows the user to submit a URL and use the text input field to provide a comma separated list of tags to associate with the URL.

The landing page will also list all current URLs in the index.
There is also a search input field allowing the user to filter the URLs in the index.
Searches are scoped to each entries title and associated tags.

When a new URL is submitted:

1. The information is sent to a dedicated Netlify function called process-bookmark.mts
2. The first step is to request the URL which will return the HTML of the page.
3. Using cheerio, get the meta information about the page. Specifically the title, meta description and the open graph image path if it exists.
4. If an open graph image path was present we can go ahead and create a new record in Turso using the title, description, open graph image path, and the provided tags.
5. Each entry should also have a created at and updated at date. In addition it should have an approval field that dictates whether an entry is visible using the frontend. Newly submitted URLs are always marked as needing approval to avoid spam and undesirable content.
6. If the HTML of the page did not contain a open graph or similar image path we need to get a screenshot of the page. To do this we will use Browserless.
7. Once Browserless returned the screenshot for the page, we will write the data to a file stored in an S3 bucket on Amazon Web Services.
8. We will then use the same data as before but this time use the path to the image on S3 instead of a open graph URL.
9. If the screenshot failed, use a provided fallback default image that will already be part of the projects in the public directory.

Drizzle Schema documentation: https://orm.drizzle.team/docs/column-types/sqlite
