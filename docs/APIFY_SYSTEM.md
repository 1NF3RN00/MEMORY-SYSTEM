#FACEBOOK
apify_api_HDdx2rhKhsrFb04Qvw5npQ43fpMaqZ31oZAimport { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "startUrls": [
        {
            #URL of page to scrape - going to have to go off of user input, we need a POST function for this
            "url": ""
        }
    ],
    "resultsLimit": 20,
    "captionText": false,
    "onlyPostsNewerThan": "2024-01-01",
    "onlyPostsOlderThan": "2024-12-31"
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("KoJrdxJCTtpon81KY").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
})();


#INSTAGRAM
import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "resultsType": "posts",
    "directUrls": [
        ""
    ],
    "resultsLimit": 100,
    "searchType": "hashtag",
    "searchLimit": 10,
    "addParentData": false
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
})();

#TIKTOK
import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "hashtags": [
        "fyp"
    ],
    "resultsPerPage": 100,
    "profileScrapeSections": [
        "videos"
    ],
    "profileSorting": "latest",
    "excludePinnedPosts": false,
    "maxFollowersPerProfile": 0,
    "maxFollowingPerProfile": 0,
    "searchSection": "",
    "maxProfilesPerQuery": 10,
    "videoSearchSorting": "MOST_RELEVANT",
    "videoSearchDateFilter": "ALL_TIME",
    "scrapeRelatedVideos": false,
    "shouldDownloadVideos": false,
    "shouldDownloadCovers": false,
    "shouldDownloadSlideshowImages": false,
    "shouldDownloadAvatars": false,
    "shouldDownloadMusicCovers": false,
    "downloadSubtitlesOptions": "NEVER_DOWNLOAD_SUBTITLES",
    "commentsPerPost": 0,
    "topLevelCommentsPerPost": 0,
    "maxRepliesPerComment": 0,
    "proxyCountryCode": "None"
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("GdWCkxBtKWOsKjdch").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
})();

#FACEBOOK ADS
import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "urls": [
        {
            "url": "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&q=linkedin&search_type=keyword_unordered&media_type=all"
        },
        {
            "url": ""
        }
    ],
    "count": 100,
    "scrapePageAds.period": "",
    "scrapePageAds.activeStatus": "all",
    "scrapePageAds.sortBy": "impressions_desc",
    "scrapePageAds.countryCode": "ALL"
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("XtaWFhbtfxyzqrFmd").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
})();

#GOOGLE MAPS
import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "searchQueries": [
        "[BUSINESS_TYPE]"
    ],
    "searchUrls": [],
    "locationName": "[REGION]",
    "language": "en",
    "maxResults": 100,
    "concurrentSearches": 1
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("8PLCMTY0L77LJQaaZ").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
})();

#GOOGLE SEARCH

import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "maxItems": 10,
    "query": "apify",
    "country": "us",
    "language": "en",
    "domain": "google.com",
    "timeRange": ""
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("YNcgn7yiLc72ayYeB").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
})();

#SEO Audit Tool
import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "startUrls": [
        "https://example.com"
    ],
    "crawlPages": true,
    "maxPages": 5,
    "maxConcurrency": 5,
    "respectRobotsTxt": true,
    "excludeUrlPatterns": [],
    "includeSubdomains": false,
    "auditMetaTags": true,
    "auditHeadings": true,
    "auditContent": true,
    "auditTechnical": true,
    "auditPerformance": true,
    "auditSchema": true,
    "auditLinks": true,
    "auditImages": true,
    "auditAccessibility": true
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("UFSUQD7pWNwN3jExC").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
})();