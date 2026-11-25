// Base URL for your PHP API
const API_BASE = '/api.php';
const IMAGE_BASE_URL = "https://modusfurniture.eu/images/productimages/";
const THUMBNAIL_BASE_URL = "https://modusfurniture.eu/images/productimages/thumbnails/";


async function loadProduct(productCode) {
  try {
    const response = await fetch(`${API_BASE}?product_code=${productCode}`);
    const product = await response.json();

    if (product.error) {
            console.error("No product code found in URL");
      // Handle the case where no product code is found
      const productDetail = document.getElementById('product-detail');
      if (productDetail) {
      productDetail.innerHTML = `
        <div class="error-message" style="
          padding: 20px;
          background: #ffebee;
          border: 1px solid #f44336;
          color: #d32f2f;
          border-radius: 4px;
          margin: 20px 0;
        ">
          <h2>Error</h2>
          <p>No product code found in the URL.</p>
        </div> `;
      }
      return
    }

    const productDetail = document.getElementById('product-detail');
    if (!productDetail) {
      console.error('Product detail container not found');
      return;
    }

    // Clear the container
    productDetail.innerHTML = '';

    // Determine if this is a collection page
    const isCollectionPage = product.ProductSubCategory === "Collection Page";

    if (isCollectionPage) {
      // Load as collection page
      await loadCollectionPage(product, productDetail);
    } else {
      // Load as single product page
      await loadSingleProductPage(product, productDetail);
    }

  } catch (error) {
    console.error('Error loading product:', error);
  }
}




async function loadSingleProductPage(product, container) {
  try {
    // Create left column container
    const leftColumn = document.createElement('div');
    leftColumn.className = 'collection-left-column-combined';
    container.appendChild(leftColumn);

    // Use the unified product display function
    await loadProductDisplay(product, leftColumn);

  } catch (error) {
    console.error('Error loading single product page:', error);
  }
}



async function loadCollectionPage(product, container) {
  try {
    // Create two-column layout
    const collectionContainer = document.createElement('div');
    collectionContainer.className = 'collection-container-two-column';

    // Left column
    const leftColumn = document.createElement('div');
    leftColumn.className = 'collection-left-column-combined';

    // Right column container
    const rightColumnContainer = document.createElement('div');
    rightColumnContainer.className = 'collection-right-column-container';

    // Append to container
    collectionContainer.appendChild(leftColumn);
    collectionContainer.appendChild(rightColumnContainer);
    container.appendChild(collectionContainer);

    // Use the unified product display function with collection flag
    await loadProductDisplay(product, leftColumn, true, rightColumnContainer);

  } catch (error) {
    console.error('Error loading collection page:', error);
  }
}


/**
 * Unified function to load and display product details
 * @param {object} product - The product data
 * @param {HTMLElement} container - The container element to append to
 * @param {boolean} isCollectionPage - Whether this is a collection page
 * @param {HTMLElement} [rightColumnContainer] - Only needed for collection pages
 */
async function loadProductDisplay(product, container, isCollectionPage = false, rightColumnContainer = null) {
  try {
    // Clear the container
    container.innerHTML = '';

    // WebDescription
    const webDescription = document.createElement('h2');
    webDescription.textContent = product.WebDescription || 'Unnamed';
    container.appendChild(webDescription);

    // Collect all potential images: internal sources first, then the database links
    const allImages = [];

    // 1. Main image slot: internal files first, then MainImage from the database
    allImages.push({
      candidates: buildImageCandidates(product.Product_Code, product.MainImage || ''),
      isMain: true,
      is3D: false
    });

    // 2. Database additional images: internal counterpart first, then the database link
    for (let i = 1; i <= 28; i++) {
      const imageKey = `Image${i}`;
      if (product[imageKey]) {
        allImages.push({
          candidates: [...new Set([getFallbackImageUrl(product.Product_Code, i), product[imageKey]])],
          isMain: false,
          is3D: false
        });
      }
    }

    // 3. Fallback additional images (_2.jpg, _3.jpg, etc.) if we don't have database images
    if (allImages.length === 1 && !product.MainImage) {
      // Only check for fallback images if we're using the fallback main image
      for (let i = 2; i <= 4; i++) {
        allImages.push({
          candidates: [getFallbackImageUrl(product.Product_Code, i)],
          isMain: false,
          is3D: false
        });
      }
    }

    // 4. Add 3D view if it exists
    if (product['3DLink']) {
      allImages.push({
        candidates: ["https://modusfurniture.eu/images/3d0icon.png"],
        isMain: false,
        is3D: true,
        iframeUrl: product['3DLink']
      });
    }

    // Main Image or 3D Link
    const imageContainer = document.createElement('div');
    imageContainer.className = 'collection-main-image-container';


    if (product['3DLink']) {
      const iframe = document.createElement('iframe');
      iframe.src = product['3DLink'];
      iframe.className = 'product-pic';
      iframe.style.width = '100%';
      iframe.style.height = '500px';
      imageContainer.appendChild(iframe);
    } else {
      const img = createImageFromCandidates(
        allImages[0].candidates,
        false,
        product.WebDescription || 'Product Image',
        'collection-main-image',
        'max-width: 100%; max-height: 500px; object-fit: contain;'
      );
      imageContainer.appendChild(img);
    }

    container.appendChild(imageContainer);

    // Create and append product info
    const additionalInfo = document.createElement('div');
    additionalInfo.className = 'collection-additional-info';
    additionalInfo.innerHTML = createProductInfoHTML(product, isCollectionPage);
    container.appendChild(additionalInfo);

    // Inquiry list button
    const inquiryBar = document.createElement('div');
    inquiryBar.className = 'inquiry-bar';
    inquiryBar.appendChild(createInquiryButton(product));
    container.appendChild(inquiryBar);

    // Only create thumbnail container if we have more than 1 image
    if (allImages.length > 1) {
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.className = 'thumbnail-container';
      thumbnailContainer.style.display = 'flex';
      thumbnailContainer.style.flexWrap = 'wrap';
      thumbnailContainer.style.justifyContent = 'center';
      thumbnailContainer.style.gap = '10px';
      thumbnailContainer.style.marginTop = '20px';

      // Add thumbnails for all images
      for (const img of allImages) {
        const thumbnail = document.createElement('img');

        // Thumbnail source first (if available), then the full-size URL as fallback
        const thumbSrcList = buildSrcList(img.candidates, true);

        thumbnail.src = thumbSrcList[0] || '';
        thumbnail.alt = img.isMain ? "Main Image" :
                      img.is3D ? "3D View" :
                      `Thumbnail ${allImages.indexOf(img) + 1}`;
        thumbnail.className = 'thumbnail';
        thumbnail.style.width = '80px';
        thumbnail.style.height = '80px';
        thumbnail.style.objectFit = img.is3D ? 'contain' : 'cover';
        thumbnail.style.cursor = 'pointer';
        thumbnail.style.border = '1px solid transparent';

        if (img.is3D) {
          thumbnail.style.backgroundColor = '#f8f8f8';
        }

        // Error handler: walk through the candidate list, hide only after the last URL fails
        let thumbAttempt = 0;
        thumbnail.onerror = function() {
          thumbAttempt++;
          if (!img.is3D && thumbAttempt < thumbSrcList.length) {
            this.src = thumbSrcList[thumbAttempt];
          } else {
            this.onerror = null;
            this.style.display = 'none';
          }
        };

        thumbnail.addEventListener('click', () => {
            if (img.is3D) {
              imageContainer.innerHTML = '';
              const iframe = document.createElement('iframe');
              iframe.src = img.iframeUrl;
              iframe.className = 'product-pic';
              iframe.style.width = '100%';
              iframe.style.height = '500px';
              imageContainer.appendChild(iframe);
            } else {
              imageContainer.innerHTML = '';

              // Show the clicked slot in the main image div, falling back to the main slot's candidates
              const clickCandidates = [...new Set([...img.candidates, ...allImages[0].candidates])];
              const mainImg = createImageFromCandidates(
                clickCandidates,
                false,
                product.WebDescription || 'Product Image',
                'collection-main-image',
                'max-width: 100%; max-height: 500px; object-fit: contain;'
              );

              imageContainer.appendChild(mainImg);
            }
          });

        thumbnailContainer.appendChild(thumbnail);
      }


      container.appendChild(thumbnailContainer);
    }


    // For collection pages, load the product list
    if (isCollectionPage && rightColumnContainer) {
      await loadCollectionProducts(product, rightColumnContainer);
    }

    // Load related products
   if (isCollectionPage || !rightColumnContainer) {
      const relatedProducts = await fetchRelatedProducts(product.Product_Code);
      displayRelatedProducts(relatedProducts);
    }

  } catch (error) {
    console.error('Error loading product display:', error);
  }
}

/**
 * Loads products for collection pages
 */
async function loadCollectionProducts(collectionProduct, rightColumnContainer) {
  try {

    const allProductsResponse = await fetch(`${API_BASE}?list=1&limit=5000`);
    const allProducts = await allProductsResponse.json();

    // Filter products by collection, category, and C-Variation
    const collectionProducts = allProducts.filter(p =>
      p.Collection === collectionProduct.Collection &&
      p.ProductCategory === collectionProduct.ProductCategory &&
      p.Product_Code !== collectionProduct.Product_Code &&
      p.Delete !== 'Delete' &&
      p.Delete !== 'Discontinued' &&
      // Add C-Variation filter
      (!collectionProduct['C-Variation'] || 
       !p['C-Variation'] || 
       p['C-Variation'] === collectionProduct['C-Variation'])
    );


    // Create right column
    const rightColumn = document.createElement('div');
    rightColumn.className = 'collection-right-column';

    if (collectionProducts.length > 0) {
      for (const product of collectionProducts) {
        const productElement = document.createElement('div');
        productElement.className = 'collection-product-item';

        // Add indicator if this is a collection page
        const isCollectionPage = product.ProductSubCategory === "Collection Page";
        const collectionPageIndicator = isCollectionPage ? '<span class="collection-page-indicator">[Collection]</span>' : '';

        // Create image with our fallback function
        const productimg = createImageWithFallback(
          product.MainImage || '',
          product.Product_Code,
          product.WebDescription || 'Product Image',
          'collection-product-thumbnail',
          'width: 60px; height: 60px; object-fit: cover;',
          true   // useThumbnail = true → thumbnails
        );

        // Create image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'collection-product-thumbnail';
        imageContainer.appendChild(productimg);

        // Create info container
        const infoContainer = document.createElement('div');
        infoContainer.className = 'product-card-info';
        infoContainer.innerHTML = `
          <span class="collection-product-code">${product.Product_Code}</span>
          <span class="collection-product-description">${product.WebDescription} ${collectionPageIndicator}</span>
        `;

        // Assemble the product element
        productElement.appendChild(imageContainer);
        productElement.appendChild(infoContainer);
        productElement.appendChild(createInquiryButton(product, 'margin-top: 6px;'));

        // Add click handler
        productElement.addEventListener('click', async () => {
          const leftColumn = document.querySelector('.collection-left-column-combined');
          if (leftColumn) {
            leftColumn.innerHTML = '';
          }
          await loadProductDisplay(product, leftColumn, false, rightColumnContainer);
        });

        rightColumn.appendChild(productElement);
      }
    } else {
      rightColumn.innerHTML = '<p>No products found in this collection.</p>';
    }

    rightColumnContainer.appendChild(rightColumn);

  } catch (error) {
    console.error('Error loading collection products:', error);
  }
}




// Function to fetch unique filter options
async function fetchFilterOptions() {
  try {
    const response = await fetch(`${API_BASE}?filter_options=1`);
    const data = await response.json();
    console.log('Filter options data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return {};
  }
}

// Function to initialize filters
async function initializeFilters() {
  const filterContainer = document.getElementById('filter-container');

  if (!filterContainer) {
    console.error('Filter container not found');
    return;
  }

  // Clear existing filters
  filterContainer.innerHTML = '';

  try {
    // Fetch filter options
    const response = await fetch(`${API_BASE}?filter_options=1`);
    const filterOptions = await response.json();
    console.log('Filter options data:', filterOptions);

    // Add search input
    const searchContainer = document.createElement('div');
    searchContainer.className = 'filter-search';
    searchContainer.innerHTML = `
      <input type="text" id="search-input" placeholder="Search products..." class="search-input">
      <button id="search-button" class="search-button">Search</button>
    `;
    filterContainer.appendChild(searchContainer);

    // Define the filters we want to show
    const filtersToShow = ['Collection', 'ProductCategory', 'ProductSubCategory'];

    // Add filter sections for each filter type
    filtersToShow.forEach(filterName => {
      if (filterOptions[filterName] && filterOptions[filterName].length > 0) {
        const filterSection = document.createElement('div');
        filterSection.className = 'filter-section';

        const filterTitle = document.createElement('h4');
        filterTitle.textContent = filterName;
        filterSection.appendChild(filterTitle);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'filter-options-container';

        // Sort collections alphabetically
        const sortedOptions = filterName === 'Collection'
          ? [...filterOptions[filterName]].sort()
          : filterOptions[filterName];

        // Make Collection and ProductSubCategory scrollable
        if (filterName === 'Collection' || filterName === 'ProductSubCategory') {
          optionsContainer.style.maxHeight = '200px';
          optionsContainer.style.overflowY = 'auto';
        }

        sortedOptions.forEach(option => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `${filterName}-${option}`;
          checkbox.value = option;
          checkbox.dataset.filterName = filterName;

          const label = document.createElement('label');
          label.htmlFor = `${filterName}-${option}`;
          label.textContent = option;

          const optionContainer = document.createElement('div');
          optionContainer.className = 'filter-option';
          optionContainer.appendChild(checkbox);
          optionContainer.appendChild(label);

          optionsContainer.appendChild(optionContainer);
        });

        filterSection.appendChild(optionsContainer);
        filterContainer.appendChild(filterSection);
      }
    });

    // Add Collection Page filter as a separate section
    const collectionPageSection = document.createElement('div');
    collectionPageSection.className = 'filter-section';

    const collectionPageTitle = document.createElement('h4');
    collectionPageTitle.textContent = 'Collection Pages';
    collectionPageSection.appendChild(collectionPageTitle);

    const collectionPageCheckbox = document.createElement('input');
    collectionPageCheckbox.type = 'checkbox';
    collectionPageCheckbox.id = 'collection-page-only';
    collectionPageCheckbox.value = 'Collection Page';
    collectionPageCheckbox.dataset.filterName = 'ProductSubCategory';

    const collectionPageLabel = document.createElement('label');
    collectionPageLabel.htmlFor = 'collection-page-only';
    collectionPageLabel.textContent = 'Show Collection Pages Only';

    const optionContainer = document.createElement('div');
    optionContainer.className = 'filter-option';
    optionContainer.appendChild(collectionPageCheckbox);
    optionContainer.appendChild(collectionPageLabel);

    collectionPageSection.appendChild(optionContainer);
    filterContainer.appendChild(collectionPageSection);

    // Add 3D Available checkbox
    const threeDSection = document.createElement('div');
    threeDSection.className = 'filter-section';

    const threeDTitle = document.createElement('h4');
    threeDTitle.textContent = '3D Available';
    threeDSection.appendChild(threeDTitle);

    const threeDCheckbox = document.createElement('input');
    threeDCheckbox.type = 'checkbox';
    threeDCheckbox.id = '3d-available';
    threeDCheckbox.dataset.filterName = '3D';

    const threeDLabel = document.createElement('label');
    threeDLabel.htmlFor = '3d-available';
    threeDLabel.textContent = '3D Available';

    threeDSection.appendChild(threeDCheckbox);
    threeDSection.appendChild(threeDLabel);
    filterContainer.appendChild(threeDSection);

    // Add search functionality
    document.getElementById('search-button').addEventListener('click', () => {
      applyFilters(true);
    });

    document.getElementById('search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyFilters(true);
      }
    });

    // Add event listeners for filter changes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', applyFilters);
    });

  } catch (error) {
    console.error('Error initializing filters:', error);
    filterContainer.innerHTML = '<p>Error loading filters.</p>';
  }
}



// Function to apply filters
function applyFilters(fromSearch = false) {
  const filters = {};
  const searchInput = document.getElementById('search-input');
  const searchTerm = searchInput ? searchInput.value.trim() : '';

  // Add checkbox filters
  document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
    const filterName = checkbox.dataset.filterName;
    const filterValue = checkbox.value;

    if (filterName === 'ProductSubCategory' && filterValue === 'Collection Page') {
      // Special handling for Collection Page filter
      if (!filters[filterName]) {
        filters[filterName] = [];
      }
      filters[filterName].push(filterValue);
    } else if (filterName === '3D') {
      // Special handling for 3D filter
      filters['has_3d'] = true;
    } else {
      // Normal filter handling
      if (!filters[filterName]) {
        filters[filterName] = [];
      }
      filters[filterName].push(filterValue);
    }
  });

  console.log('Filters to apply:', filters);
  loadProducts(1, 12, filters);
}



// Fetch and display product list (for products.html)
async function loadProducts(page = 1, limit = 12, filters = {}) {
  try {
    // Construct query parameters for filters
    const queryParams = new URLSearchParams({ list: 1, page, limit });

    // Add filter parameters
    for (const filterName in filters) {
      if (filterName === 'has_3d') {
        queryParams.append('has_3d', 1);
      } else if (Array.isArray(filters[filterName])) {
        filters[filterName].forEach(value => {
          queryParams.append(`${filterName}[]`, value);
        });
      }
    }

    console.log('Query params:', queryParams.toString());
    const response = await fetch(`${API_BASE}?${queryParams.toString()}`);
    const products = await response.json();
    console.log('Filtered products:', products);

    const productList = document.getElementById('product-list');
    productList.innerHTML = '';

    if (products.error) {
      productList.innerHTML = `<p>${products.error}</p>`;
      return;
    }

    if (!Array.isArray(products) || products.length === 0) {
      productList.innerHTML = '<p>No products found matching the selected filters.</p>';
      return;
    }

        products.forEach(product => {
          const productCard = document.createElement('a');
          productCard.className = 'product-card';
          productCard.href = `/product/${product.Product_Code}`;

          // Use our existing function
          const productimg = createImageWithFallback(
            product.MainImage || '',
            product.Product_Code,
            product.WebDescription || 'Product Image',
            'product-thumbnail',
            'width: 100%; height: 200px; object-fit: contain;',
            true   // useThumbnail = true → thumbnails
          );

          // Create image container
          const imageContainer = document.createElement('div');
          imageContainer.className = 'product-card-image';
          imageContainer.appendChild(productimg);

          // Create info container (unchanged)
          const infoContainer = document.createElement('div');
          infoContainer.className = 'product-card-info';
          infoContainer.innerHTML = `
            <h3>${product.Product_Code || 'Code Unknown'}</h3>
            <p>${product.WebDescription || 'Unnamed'}</p>
            <p><strong>Collection:</strong> ${product.Collection || 'N/A'}</p>
            <p><strong>Category:</strong> ${product.ProductCategory || 'N/A'}</p>
            <p><strong>Subcategory:</strong> ${product.ProductSubCategory || 'N/A'}</p>
          `;

          productCard.appendChild(imageContainer);
          productCard.appendChild(infoContainer);
          productCard.appendChild(createInquiryButton(product, 'margin-top: 8px; width: 100%;'));
          productList.appendChild(productCard);
        });


    // Pagination
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = `
      <button class="prev-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${page}</span>
      <button class="next-page" data-page="${page + 1}">Next</button>
      <input type="number" id="page-number" min="1" value="${page}" placeholder="Page">
      <button id="go-to-page">Go to Page</button>
    `;

    // Add event listeners for pagination buttons
    document.querySelectorAll('.prev-page').forEach(button => {
      button.addEventListener('click', () => {
        const newPage = parseInt(button.getAttribute('data-page'));
        loadProducts(newPage, limit, filters);
      });
    });

    document.querySelectorAll('.next-page').forEach(button => {
      button.addEventListener('click', () => {
        const newPage = parseInt(button.getAttribute('data-page'));
        loadProducts(newPage, limit, filters);
      });
    });

    document.getElementById('go-to-page').addEventListener('click', () => {
      const newPage = parseInt(document.getElementById('page-number').value);
      loadProducts(newPage, limit, filters);
    });

  } catch (error) {
    console.error('Error:', error);
    document.getElementById('product-list').innerHTML = '<p>Error loading products.</p>';
  }
}



/**
 * Displays related products in the UI
 * @param {Array} products - Array of product objects to display
 */
function displayRelatedProducts(products) {
  try {
    const relatedProductsContainer = document.createElement('div');
    relatedProductsContainer.className = 'related-products-container';

    const title = document.createElement('h3');
    title.className = 'related-products-title';
    title.textContent = 'Related Products';
    relatedProductsContainer.appendChild(title);

    const listContainer = document.createElement('div');
    listContainer.className = 'related-products-list';
    relatedProductsContainer.appendChild(listContainer);

    if (products.length > 0) {
      for (const product of products) {
        const productCard = document.createElement('a');
        productCard.className = 'related-product-card';
        productCard.href = `/product/${product.Product_Code}`;

        // Use our image function
        const imageContainer = document.createElement('div');
        imageContainer.className = 'related-product-image';
        imageContainer.style.width = '100%';
        imageContainer.style.height = '200px';
        imageContainer.style.overflow = 'hidden';

        const productimg = createImageWithFallback(
          product.MainImage || '',
          product.Product_Code,
          product.WebDescription || 'Product Image',
          'related-product-img',
          'width: 100%; height: 100%; object-fit: contain;',
          true   // useThumbnail = true → thumbnails
        );
        imageContainer.appendChild(productimg);

        const infoContainer = document.createElement('div');
        infoContainer.className = 'related-product-info';
        infoContainer.innerHTML = `
          <div class="related-product-code">${product.Product_Code || 'N/A'}</div>
          <div class="related-product-description">${product.WebDescription || 'No description'}</div>
          <div class="related-product-collection">${product.Collection || 'No collection'}</div>
        `;

        productCard.appendChild(imageContainer);
        productCard.appendChild(infoContainer);
        productCard.appendChild(createInquiryButton(product, 'margin-top: 8px; width: 100%;'));
        listContainer.appendChild(productCard);
      }
    } else {
      listContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No related products found.</p>';
    }

    // Add to DOM
    const productDetail = document.getElementById('product-detail');
    if (productDetail) {
      const existingRelated = productDetail.querySelector('.related-products-container');
      if (existingRelated) productDetail.removeChild(existingRelated);
      productDetail.appendChild(relatedProductsContainer);
    }

  } catch (error) {
    console.error('Error in displayRelatedProducts:', error);
  }
}


/**
 * Fetches related products based on your business rules
 * @param {string} productCode - The product code of the current product
 * @returns {Promise<Array>} Array of related product objects
 */
async function fetchRelatedProducts(productCode) {
  try {
    // Fetch current product
    const currentProductResponse = await fetch(`${API_BASE}?product_code=${productCode}`);
    const currentProduct = await currentProductResponse.json();
    if (currentProduct.error) return [];

    // Fetch ALL products
    const allProductsResponse = await fetch(`${API_BASE}?list=1&limit=5000`);
    const allProducts = await allProductsResponse.json();

    // Filter out deleted products and current product
    const availableProducts = allProducts.filter(p =>
      p.Delete !== 'Delete' && p.Delete !== 'Discontinued' && p.Product_Code !== productCode
    );

    // Apply your business rules
    let relatedProducts = [];

    if (currentProduct.ProductSubCategory === "Collection Page") {
      // For collection pages:
      // 1. Same Collection, different C-Variation
      relatedProducts.push(...availableProducts.filter(p =>
        p.ProductSubCategory === "Collection Page" &&
        p.Collection === currentProduct.Collection &&
        p['C-Variation'] !== currentProduct['C-Variation']
      ));

      // 2. Same Collection, different ProductCategory
      relatedProducts.push(...availableProducts.filter(p =>
        p.ProductSubCategory === "Collection Page" &&
        p.Collection === currentProduct.Collection &&
        p.ProductCategory !== currentProduct.ProductCategory &&
        !relatedProducts.some(rp => rp.Product_Code === p.Product_Code)
      ));

      // 3. Same ProductCategory (any Collection)
      if (relatedProducts.length < 15) {
        relatedProducts.push(...availableProducts.filter(p =>
          p.ProductSubCategory === "Collection Page" &&
          p.ProductCategory === currentProduct.ProductCategory &&
          !relatedProducts.some(rp => rp.Product_Code === p.Product_Code)
        ));
      }

      // 4. Same Collection (regular products)
      if (relatedProducts.length < 15) {
        relatedProducts.push(...availableProducts.filter(p =>
          p.ProductSubCategory !== "Collection Page" &&
          p.Collection === currentProduct.Collection &&
          !relatedProducts.some(rp => rp.Product_Code === p.Product_Code)
        ));
      }
    } else {
      // For single products:
      // 1. Collection page for this product's Collection+Category
      const collectionPage = availableProducts.find(p =>
        p.ProductSubCategory === "Collection Page" &&
        p.Collection === currentProduct.Collection &&
        p.ProductCategory === currentProduct.ProductCategory
      );
      if (collectionPage) relatedProducts.push(collectionPage);

      // 2. Same Collection, different C-Variation
      if (currentProduct['C-Variation'] && currentProduct['C-Variation'].trim() !== "") {
        relatedProducts.push(...availableProducts.filter(p =>
          p.Collection === currentProduct.Collection &&
          p['C-Variation'] !== currentProduct['C-Variation'] &&
          p.Product_Code !== collectionPage?.Product_Code
        ));
      }

      // 3. Same Collection, different ProductCategory
      const otherCollectionPage = availableProducts.find(p =>
        p.ProductSubCategory === "Collection Page" &&
        p.Collection === currentProduct.Collection &&
        p.ProductCategory !== currentProduct.ProductCategory &&
        !relatedProducts.some(rp => rp.Product_Code === p.Product_Code)
      );
      if (otherCollectionPage) relatedProducts.push(otherCollectionPage);


      // 4. Same Collection
      if (relatedProducts.length < 15) {
        relatedProducts.push(...availableProducts.filter(p =>
          p.Collection === currentProduct.Collection &&
          !relatedProducts.some(rp => rp.Product_Code === p.Product_Code)
        ));
      }

      // 5. Same ProductSubCategory
      if (relatedProducts.length < 15) {
        relatedProducts.push(...availableProducts.filter(p =>
          p.ProductSubCategory === currentProduct.ProductSubCategory &&
          p.Product_Code !== currentProduct.Product_Code &&
          !relatedProducts.some(rp => rp.Product_Code === p.Product_Code)
        ));
      }
    }

    return relatedProducts.slice(0, 15);
  } catch (error) {
    console.error('Error in fetchRelatedProducts:', error);
    return [];
  }
}




/**
 * Creates product info HTML with language-specific units
 * @param {object} product - The product data
 * @param {boolean} isCollectionPage - Whether this is for a collection page
 * @returns {string} HTML string for product info
 */
function createProductInfoHTML(product, isCollectionPage = false) {
  const useUSUnits = shouldUseUSUnits();

  // Collect material fields
  const materialFields = [ product.Material,
    product.BaseMaterial, product.BaseMaterial2,
    product.ConstructionMaterial, product.ConstructionMaterial2,
    product.ConstructionMaterial3, product.ConstructionMaterial4,
    product.FrameMaterial, product.FrameMaterial2,
    product.GlassMaterialDetails, product.GlassMaterialDetails2
  ].filter(Boolean);

  // Get dimension fields based on language
  const heightField = useUSUnits ? product.ItemHeight : product.ItemHeightcm;
  const widthField = useUSUnits ? product.ItemWidth : product.ItemWidthcm;
  const lengthField = useUSUnits ? product.ItemLength : product.ItemLengthcm;
  const weightField = useUSUnits ? product.ItemWeightEach : product.ItemWeightkg;

  // Prepare dimension fields with proper units
  const dimensionFields = [];
  if (heightField) {
    dimensionFields.push(`${heightField}${useUSUnits ? '"' : 'cm'}`);
  }
  if (widthField) {
    dimensionFields.push(`${widthField}${useUSUnits ? '"' : 'cm'}`);
  }
  if (lengthField) {
    dimensionFields.push(`${lengthField}${useUSUnits ? '"' : 'cm'}`);
  }

  // Prepare weight info
  const weightLabel = 'Weight';
  const weightUnit = useUSUnits ? 'lbs' : 'kg';

  // Build HTML content
  let html = `
    <h3>${product.Product_Code || 'N/A'}</h3>
    <h3><strong> ${product.Collection || 'N/A'}</strong>  <strong> ${product.ProductCategory || 'N/A'}</strong></h3>
    <p><strong>Subcategory:</strong> ${product.ProductSubCategory || 'N/A'}</p>
  `;

  // Add collection ad copy if it exists
   if (product.CollectionAdCopy) {
    html += `<p class="collection-ad-copy">${product.CollectionAdCopy}</p>`;
  }

  // Add materials if they exist
  if (materialFields.length > 0) {
    html += `<p><strong>Material:</strong> ${materialFields.join(', ')}</p>`;
  }

  // Add dimensions if they exist
  if (dimensionFields.length > 0 && !isCollectionPage) {
    html += `<p><strong>Dimensions:</strong> ${dimensionFields.join(' x ')}</p>`;
  }

  // Add weight if it exists
  if (weightField && !isCollectionPage) {
    html += `<p><strong>${weightLabel}:</strong> ${weightField} ${weightUnit}</p>`;
  }

  // Add cube if it exists
  if (product.Cube && !isCollectionPage) {
    html += `<p><strong>Cube:</strong> ${product.Cube}</p>`;
  }

  // Add country of origin if it exists
  if (product.CountryofOrigin) {
    html += `<p><strong>Made in:</strong> ${product.CountryofOrigin}</p>`;
  }

  return html;
}



/**
 * Derives the thumbnail URL for internal product images, leaves other URLs unchanged
 * @param {string} url - The image URL (full-size or thumbnail)
 * @returns {string} The thumbnail URL
 */
function toThumbnailUrl(url) {
  if (url.includes(THUMBNAIL_BASE_URL)) return url;
  return url.includes(IMAGE_BASE_URL) ? url.replace(IMAGE_BASE_URL, THUMBNAIL_BASE_URL) : url;
}

/**
 * Derives the full-size URL from a thumbnail URL, leaves other URLs unchanged
 * @param {string} url - The image URL (thumbnail or full-size)
 * @returns {string} The full-size URL
 */
function toFullSizeUrl(url) {
  return url.includes(THUMBNAIL_BASE_URL) ? url.replace(THUMBNAIL_BASE_URL, IMAGE_BASE_URL) : url;
}

/**
 * Builds the ordered candidate list for the main image of a product:
 * internal files first, then the database link
 * @param {string} productCode - The product code
 * @param {string} dbUrl - The MainImage URL from the database (may be empty)
 * @returns {Array<string>} Deduplicated candidate URLs, internal first
 */
function buildImageCandidates(productCode, dbUrl) {
  const candidates = [
    `${IMAGE_BASE_URL}${productCode}.jpg`,
    `${IMAGE_BASE_URL}${productCode}_1.jpg`,
    `${IMAGE_BASE_URL}${productCode}_2.jpg`,
    `${IMAGE_BASE_URL}${productCode}_3.jpg`,
    `${IMAGE_BASE_URL}${productCode}_4.jpg`,
    dbUrl || ''
  ].filter(url => url);
  return [...new Set(candidates)];
}

/**
 * Builds the ordered src list for an img element from full-size candidates.
 * For thumbnails each candidate is tried as thumbnail first, then as full-size.
 * @param {Array<string>} candidates - Ordered candidate URLs (full-size)
 * @param {boolean} useThumbnail - Whether thumbnail URLs should be preferred
 * @returns {Array<string>} Ordered list of URLs to try
 */
function buildSrcList(candidates, useThumbnail) {
  const srcList = [];
  for (const candidate of candidates) {
    const url = useThumbnail ? toThumbnailUrl(candidate) : toFullSizeUrl(candidate);
    if (!srcList.includes(url)) srcList.push(url);
    if (useThumbnail) {
      const fullUrl = toFullSizeUrl(candidate);
      if (fullUrl !== url && !srcList.includes(fullUrl)) srcList.push(fullUrl);
    }
  }
  return srcList;
}

/**
 * Creates an img element that walks through the candidate list on error
 * and shows a placeholder after the last candidate fails
 * @param {Array<string>} candidates - Ordered candidate URLs (full-size)
 * @param {boolean} useThumbnail - Prefer thumbnail URLs
 * @param {string} altText - Alt text for the image
 * @param {string} className - CSS class for the image
 * @param {string} style - Inline styles for the image
 * @returns {HTMLImageElement} Image element with fallback handling
 */
function createImageFromCandidates(candidates, useThumbnail, altText, className, style) {
  const img = document.createElement('img');
  img.alt = altText;
  img.className = className;
  img.style.cssText = style;
  img.loading = 'lazy';

  const srcList = buildSrcList(candidates, useThumbnail);
  let attempt = 0;
  img.src = srcList[0] || '';

  img.onerror = function() {
    attempt++;
    if (attempt < srcList.length) {
      this.src = srcList[attempt];
    } else {
      this.onerror = null;
      const placeholder = document.createElement('div');
      const widthMatch = style.match(/width:\s*(\d+%?)/);
      const heightMatch = style.match(/height:\s*(\d+%?)/);
      const width = widthMatch ? widthMatch[1] : '100%';
      const height = heightMatch ? heightMatch[1] : '200px';
      placeholder.style.cssText = `
        width: ${width};
        height: ${height};
        background: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #999;
        font-size: 14px;
      `;
      placeholder.textContent = 'No Image';
      if (this.parentNode) {
        this.parentNode.replaceChild(placeholder, this);
      }
    }
  };

  return img;
}


/**
 * Generates fallback image URLs for products
 * @param {string} productCode - The product code
 * @param {number} [index] - Optional index for additional images
 * @returns {string} The fallback image URL
 */
function getFallbackImageUrl(productCode, index = null) {
  if (index === null) {
    return `${IMAGE_BASE_URL}${productCode}.jpg`;
  } else {
    return `${IMAGE_BASE_URL}${productCode}_${index}.jpg`;
  }
}



/**
 * Checks if an image exists at a given URL
 * @param {string} url - The image URL to check
 * @returns {Promise<boolean>} True if the image exists
 */
async function imageExists(url) {
  try {
    // Add a cache buster to prevent cached 404 responses
    const urlWithCacheBuster = url.includes('?') ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`;

    const response = await fetch(urlWithCacheBuster, {
      method: 'HEAD',
      mode: 'no-cors', // Handle CORS issues
      cache: 'no-store'
    });

    // If we get a response (even if we can't read the status due to CORS),
    // assume the image exists if we don't get a network error
    return true;
  } catch (error) {
    // If we get a network error, the image doesn't exist
    return false;
  }
}


/**
 * Creates an image element with fallback handling.
 * Internal files are tried first, then the database link (converted to
 * thumbnail or full-size depending on useThumbnail)
 * @param {string} primaryUrl - Primary image URL (from MainImage/database)
 * @param {string} productCode - The product code (for internal URLs)
 * @param {string} altText - Alt text for the image
 * @param {string} className - CSS class for the image
 * @param {string} style - Inline styles for the image
 * @param {boolean} [useThumbnail=false] - Use thumbnail URLs for internal images
 * @returns {HTMLImageElement} Image element with fallback support
 */
function createImageWithFallback(primaryUrl, productCode, altText, className, style, useThumbnail = false) {
  return createImageFromCandidates(buildImageCandidates(productCode, primaryUrl), useThumbnail, altText, className, style);
}


/**
 * Gets the user's preferred language
 * @returns {string} The language code (e.g., 'en-US', 'de-DE')
 */
function getUserLanguage() {
  return (
    navigator.languages && navigator.languages[0] ||
    navigator.language ||
    navigator.userLanguage ||
    navigator.browserLanguage ||
    'en-US'
  );
}

/**
 * Checks if the user prefers US units
 * @returns {boolean} True if US units should be used
 */
function shouldUseUSUnits() {
  const language = getUserLanguage().toLowerCase();
  return language.startsWith('en-us') ||
         language === 'en' ||
         (language.startsWith('en-') && !language.startsWith('en-gb'));
}




function getProductCodeFromURL() {
  const pathParts = window.location.pathname.split('/');
  // Get the last part of the path, which should be the product code
  return pathParts[pathParts.length - 1];
}



// Load appropriate data based on page
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded!");
  injectInquiryBadge();
  if (window.location.pathname === '/products') {
    initializeFilters();
    loadProducts();
  } else if (window.location.pathname.startsWith('/product/')) {
    const productCode = getProductCodeFromURL();
    console.log("Extracted product code from URL:", productCode);

      loadProduct(productCode);

  } else if (window.location.pathname === '/inquiry' || window.location.pathname.startsWith('/inquiry')) {
    loadInquiryPage();
  }
});


/* ============================================================
   Inquiry list ("Anfrageliste") - cart-like, without prices
   Stored in localStorage; sent via POST to api.php?inquiry=1
   (falls back to a prefilled mailto: link)
   ============================================================ */
const INQUIRY_KEY = 'modus_inquiry_list';
const INQUIRY_EMAIL = 'info@modusfurniture.eu';

function getInquiryList() {
  try {
    const raw = localStorage.getItem(INQUIRY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveInquiryList(list) {
  try {
    localStorage.setItem(INQUIRY_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Could not save inquiry list:', e);
  }
  updateInquiryBadge();
}

function isInInquiry(productCode) {
  return getInquiryList().some(item => item.code === productCode);
}

function addToInquiry(product) {
  const list = getInquiryList();
  if (list.some(item => item.code === product.Product_Code)) return false;
  list.push({
    code: product.Product_Code,
    description: product.WebDescription || '',
    collection: product.Collection || '',
    category: product.ProductCategory || ''
  });
  saveInquiryList(list);
  return true;
}

function removeFromInquiry(productCode) {
  saveInquiryList(getInquiryList().filter(item => item.code !== productCode));
}

function injectInquiryBadge() {
  if (document.getElementById('inquiry-badge')) return;
  const badge = document.createElement('a');
  badge.id = 'inquiry-badge';
  badge.href = '/inquiry';
  badge.className = 'inquiry-badge';
  badge.title = 'Anfrageliste öffnen';
  document.body.appendChild(badge);
  updateInquiryBadge();
}

function updateInquiryBadge() {
  const badge = document.getElementById('inquiry-badge');
  if (!badge) return;
  badge.textContent = `Anfrage (${getInquiryList().length})`;
}

function createInquiryButton(product, style) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'inquiry-add-btn';
  if (style) btn.style.cssText = style;

  const refresh = () => {
    const inList = isInInquiry(product.Product_Code);
    btn.textContent = inList ? '✓ In der Anfrageliste' : '+ Zur Anfrageliste';
    btn.classList.toggle('in-list', inList);
  };
  refresh();

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInInquiry(product.Product_Code)) {
      removeFromInquiry(product.Product_Code);
    } else {
      addToInquiry(product);
    }
    refresh();
  });

  return btn;
}

async function loadInquiryPage() {
  const listContainer = document.getElementById('inquiry-list');
  const form = document.getElementById('inquiry-form');
  if (!listContainer || !form) return;

  // Enrich stored codes with fresh product data, fall back to the stored snapshot
  const stored = getInquiryList();
  const items = [];
  for (const item of stored) {
    let product = null;
    try {
      const res = await fetch(`${API_BASE}?product_code=${encodeURIComponent(item.code)}`);
      const data = await res.json();
      if (data && !data.error) product = data;
    } catch (e) {
      // keep stored snapshot
    }
    items.push({ ...item, product });
  }

  renderInquiryList(listContainer, items);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const status = document.getElementById('inquiry-status');
    const current = getInquiryList();
    const name = document.getElementById('inquiry-name').value.trim();
    const company = document.getElementById('inquiry-company').value.trim();
    const email = document.getElementById('inquiry-email').value.trim();
    const message = document.getElementById('inquiry-message').value.trim();

    if (current.length === 0) {
      status.textContent = 'Ihre Anfrageliste ist leer.';
      status.className = 'inquiry-status error';
      return;
    }
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      status.textContent = 'Bitte geben Sie Ihren Namen und eine gültige E-Mail-Adresse an.';
      status.className = 'inquiry-status error';
      return;
    }

    status.textContent = 'Anfrage wird gesendet ...';
    status.className = 'inquiry-status';

    try {
      const response = await fetch(`${API_BASE}?inquiry=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, email, message, products: current })
      });
      const result = await response.json();
      if (result.success) {
        status.textContent = `Vielen Dank, ${name}! Ihre Anfrage wurde an ${INQUIRY_EMAIL} gesendet.`;
        status.className = 'inquiry-status success';
        saveInquiryList([]);
        loadInquiryPage();
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }
    } catch (err) {
      status.textContent = '';
      status.className = 'inquiry-status error';
      status.append(`Die Anfrage konnte nicht direkt gesendet werden (${err.message}). `);
      const link = document.createElement('a');
      link.href = buildInquiryMailto(name, company, email, message, current);
      link.textContent = 'Stattdessen per E-Mail-Programm senden';
      status.appendChild(link);
    }
  };
}

function renderInquiryList(container, items) {
  container.innerHTML = '';
  if (items.length === 0) {
    container.innerHTML = '<p>Ihre Anfrageliste ist leer. <a href="/products">Zur Produktübersicht</a></p>';
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'inquiry-item';

    const p = item.product || {};
    const img = createImageWithFallback(
      p.MainImage || '',
      item.code,
      p.WebDescription || item.description || 'Product Image',
      'inquiry-item-image',
      'width: 80px; height: 80px; object-fit: cover;',
      true
    );

    const info = document.createElement('div');
    info.className = 'inquiry-item-info';
    info.innerHTML = `
      <strong>${p.Product_Code || item.code}</strong>
      <p>${p.WebDescription || item.description || ''}</p>
      <p>${[p.Collection || item.collection, p.ProductCategory || item.category].filter(Boolean).join(' · ')}</p>
    `;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'inquiry-remove-btn';
    removeBtn.textContent = 'Entfernen';
    removeBtn.addEventListener('click', () => {
      removeFromInquiry(item.code);
      loadInquiryPage();
    });

    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }
}

function buildInquiryMailto(name, company, email, message, items) {
  const subject = `Produktanfrage über modusfurniture.eu${name ? ' – ' + name : ''}`;
  const lines = [
    `Name: ${name}`,
    `Firma: ${company}`,
    `E-Mail: ${email}`,
    '',
    'Nachricht:',
    message,
    '',
    `Angefragte Produkte (${items.length}):`
  ];
  for (const item of items) {
    lines.push(`- ${item.code} | ${item.description || ''} | ${item.collection || ''}`);
  }
  return `mailto:${INQUIRY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}
