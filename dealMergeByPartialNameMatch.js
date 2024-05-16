/**********************************************************************
 * File Name: dealMerge.js
 * Description: This file contains the logic for checking for duplicate deals based on a partial match in the deal name and a date range, and merging the duplicates.
 *
 * Created By: Joshua Bradford
 * Create Date: 2024-05-16
 *
 * Last Updated By: Joshua Bradford
 * Last Update Date: 2024-05-16
 *
 * Version: 1.0
 **********************************************************************/

// Define the date range for the deals to check
const startRange = new Date("2024-02-01T00:00:00Z").getTime();
const endRange = new Date("2024-02-29T23:59:59Z").getTime();
// Define the access token for the HubSpot API - You must replace this with your own access token
const ACCESS_TOKEN = "";
// Define the deal name to check for
dealNameCheck = "";

async function getAllDeals() {
  // Define the limit for each API request
  const limit = 100;
  // Define the after cursor for pagination
  let after = undefined;
  // Initialize an array to store all deals
  let allDeals = [];

  try {
    // Import the fetch function from the node-fetch library - If you are running this from a terminal make sure you use the command `npm install node-fetch` to install the library
    const fetch = (await import("node-fetch")).default;

    // Fetch all deals using pagination
    do {
      // Construct the URL for fetching deals
      const url = new URL("https://api.hubapi.com/crm/v3/objects/deals");
      // Append the query parameters to the URL
      url.searchParams.append("limit", limit);
      // Append the properties to fetch
      if (after) {
        // Append the after cursor for pagination
        url.searchParams.append("after", after);
      }

      // Fetch the deals using the constructed URL
      const response = await fetch(url, {
        // Set the headers for the request
        headers: {
          // Set the authorization header with the access token
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          // Set the content type header
          "Content-Type": "application/json",
        },
      });

      // Check if the response is not OK
      if (!response.ok) {
        // Throw an error with the status code
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Parse the response body as JSON
      const responseBody = await response.json();

      // Log the response body for debugging
      const filteredDeals = responseBody.results.filter((deal) => {
        // Get the created date of the deal
        const createdAt = new Date(deal.properties.createdate).getTime();
        // Get the deal name
        const dealname = deal.properties.dealname || "";
        // Check if the deal is within the date range
        const isInDateRange = createdAt >= startRange && createdAt <= endRange;
        // Check if the deal name contains the specified string - "dealNameCheck" can be set at the top of the script
        const isDealNameMatch = dealname.includes(dealNameCheck);

        // Log the deal ID, created date, and deal name for debugging
        if (isInDateRange && isDealNameMatch) {
          // Log the deal ID, created date, and deal name
          console.log(
            `Deal ID: ${deal.id}, Created At: ${createdAt}, Deal Name: "${dealname}"`
          );
        }

        // Return true if the deal is within the date range and the deal name matches
        return isInDateRange && isDealNameMatch;
      });

      // Concatenate the filtered deals to the allDeals array
      allDeals = allDeals.concat(filteredDeals);

      // Update the after cursor for pagination
      after =
        // Check if the response body contains the paging object and the next cursor
        responseBody.paging && responseBody.paging.next
          ? // Set the after cursor to the next cursor
            responseBody.paging.next.after
          : // Set the after cursor to undefined if there is no next cursor
            undefined;
      // Log the after cursor for debugging
    } while (after);

    // Return all deals
    return allDeals;
    // Catch any errors that occur during the fetch process
  } catch (e) {
    // Log the error message
    console.error(`Error fetching deals: ${e.message}`);
    // Return an empty array if there is an error
    return [];
  }
}

// Function to find duplicate deals based on a partial match in the deal name
function findDuplicateDeals(deals) {
  const dealsMap = new Map();

  // Iterate over the deals
  for (const deal of deals) {
    // Get the deal name
    const dealname = deal.properties.dealname;
    // Check if the deal name is already in the map
    if (dealsMap.has(dealname)) {
      // Add the deal to the existing deal name
      dealsMap.get(dealname).push(deal);
      // Log the duplicate deal for debugging
    } else {
      // Initialize the deal name with the first deal
      dealsMap.set(dealname, [deal]);
    }
  }

  // Filter out non-duplicates
  return Array.from(dealsMap.values()).filter(
    (dealGroup) => dealGroup.length > 1
  );
}

// Function to fetch deal details by deal ID
async function fetchDealDetails(dealId) {
  // Import the fetch function from the node-fetch library
  const fetch = (await import("node-fetch")).default;
  // Construct the URL for fetching deal details
  const url = `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`;

  // Fetch the deal details using the constructed URL
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  // Check if the response is not OK
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  // Return the deal details as JSON
  return await response.json();
}

// Function to merge duplicate deals
async function mergeDeals(duplicateGroups) {
  const fetch = (await import("node-fetch")).default;

  // Iterate over the duplicate groups
  for (const group of duplicateGroups) {
    // Sort the group by created date, oldest first
    group.sort(
      // Sort the deals by created date
      (a, b) =>
        // Compare the created date of the deals
        new Date(a.properties.createdate) - new Date(b.properties.createdate)
    );
    // The oldest deal becomes the primary
    const primaryDeal = group[0];

    // Iterate over the secondary deals
    for (let i = 1; i < group.length; i++) {
      // The rest of the deals become secondary
      const secondaryDeal = group[i];

      try {
        // Set the primary deal details
        const primaryDealDetails = await fetchDealDetails(primaryDeal.id);
        // Set the secondary deal details
        const secondaryDealDetails = await fetchDealDetails(secondaryDeal.id);

        // Log the fetched deal details
        console.log(
          `Primary Deal Details: ${JSON.stringify(primaryDealDetails, null, 2)}`
        );
        console.log(
          `Secondary Deal Details: ${JSON.stringify(
            secondaryDealDetails,
            null,
            2
          )}`
        );

        // Log merge input for debugging
        console.log(
          `Attempting to merge deal ID: ${secondaryDeal.id} into ${primaryDeal.id}`
        );

        // Construct the merge input
        const mergeInput = {
          // Set the primary object ID to the primary deal ID
          primaryObjectId: primaryDeal.id,
          // Set the secondary object ID to the secondary deal ID
          objectIdToMerge: secondaryDeal.id,
        };

        // Log the entire merge request
        console.log(`Merge Request: ${JSON.stringify(mergeInput, null, 2)}`);

        // Perform the merge request
        const response = await fetch(
          "https://api.hubapi.com/crm/v3/objects/deals/merge",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            // Convert the merge input to JSON
            body: JSON.stringify(mergeInput),
          }
        );

        // Check if the response is not OK
        if (!response.ok) {
          const responseBody = await response.text();
          console.error(`Merge failed with status: ${response.status}`);
          console.error(`Merge Response: ${responseBody}`);
          console.error(
            `Merge Response Headers: ${JSON.stringify(
              response.headers.raw(),
              null,
              2
            )}`
          );
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Attempt to log response body
        const responseBody = await response.text();
        console.log(`Merge Response: ${responseBody}`);

        // Attempt to log response headers
        console.log(
          `Merge Response Headers: ${JSON.stringify(
            response.headers.raw(),
            null,
            2
          )}`
        );

        console.log("Merged deal:", secondaryDeal.id, "into", primaryDeal.id);
      } catch (e) {
        console.error(`Error with deal ID: ${secondaryDeal.id} - ${e.message}`);
      }
    }
  }
}

// Main function to execute the deal merge process
(async () => {
  // Fetch all deals
  const allDeals = await getAllDeals();
  // Find duplicate deals based on a partial match in the deal name
  const duplicateGroups = findDuplicateDeals(allDeals);
  // Merge the duplicate deals
  await mergeDeals(duplicateGroups);
})();
