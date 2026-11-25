<?php

try {
  $dbh = new PDO("mysql:host=$db_server;dbname=$db_name", $db_benutzer, $db_passwort);
  $dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // Handle POST request to send an inquiry list by email
  if (isset($_GET['inquiry']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $name    = isset($input['name']) ? trim($input['name']) : '';
    $company = isset($input['company']) ? trim($input['company']) : '';
    $email   = isset($input['email']) ? trim($input['email']) : '';
    $message = isset($input['message']) ? trim($input['message']) : '';
    $products = isset($input['products']) && is_array($input['products']) ? $input['products'] : [];

    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || empty($products)) {
      echo json_encode(["error" => "Name, gueltige E-Mail und mindestens ein Produkt sind erforderlich."]);
      exit;
    }

    $lines = ["Name: $name", "Firma: $company", "E-Mail: $email", "", "Nachricht:", $message, "", "Angefragte Produkte (" . count($products) . "):"];
    foreach ($products as $p) {
      $code = isset($p['code']) ? $p['code'] : '';
      $stmt = $dbh->prepare("SELECT Product_Code, WebDescription, Collection, ProductCategory FROM Produktdaten WHERE Product_Code = :code");
      $stmt->bindParam(':code', $code);
      $stmt->execute();
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      if ($row) {
        $lines[] = "- {$row['Product_Code']} | {$row['WebDescription']} | {$row['Collection']} | {$row['ProductCategory']}";
      } else {
        $lines[] = "- $code | " . (isset($p['description']) ? $p['description'] : '');
      }
    }

    $subjectName = str_replace(["\r", "\n"], ' ', $name);
    $subject = 'Produktanfrage ueber modusfurniture.eu' . ($subjectName !== '' ? ' - ' . $subjectName : '');
    $headers = "From: noreply@modusfurniture.eu\r\n" .
               "Reply-To: $email\r\n" .
               "Content-Type: text/plain; charset=UTF-8\r\n";
    $sent = mail('info@modusfurniture.eu', $subject, implode("\n", $lines), $headers);
    echo json_encode($sent ? ["success" => true] : ["error" => "E-Mail konnte nicht gesendet werden."]);
    exit;
  }

  // Handle GET request for filter options
  if (isset($_GET['filter_options'])) {
    $filterOptions = [];

    // Fetch unique values for each filter
    $filters = ['ProductCategory', 'ProductSubCategory', 'Collection', 'Color', 'Material', 'Lifestyle'];
    foreach ($filters as $filter) {
      $stmt = $dbh->prepare("SELECT DISTINCT $filter FROM Produktdaten WHERE $filter IS NOT NULL AND $filter != '' AND `Delete` != 'Delete' AND `Delete` != 'Discontinued'");
      $stmt->execute();
      $filterOptions[$filter] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    echo json_encode($filterOptions);
    exit;
  }

  // Handle GET request for a single product
  if (isset($_GET['product_code'])) {
    $productCode = $_GET['product_code'];
    $stmt = $dbh->prepare("SELECT * FROM Produktdaten WHERE Product_Code = :productCode");
    $stmt->bindParam(':productCode', $productCode);
    $stmt->execute();
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($product) {
      echo json_encode($product);
    } else {
      echo json_encode(["error" => "Product not found"]);
    }
    exit;
  }


// Handle GET request for product list with filters
if (isset($_GET['list'])) {
    $limit = isset($_GET['limit']) ? min(intval($_GET['limit']), 5000) : 1000;
    $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
    $offset = ($page - 1) * $limit;

    $query = "SELECT * FROM Produktdaten WHERE `Delete` != 'Delete' AND `Delete` != 'Discontinued'";
    $conditions = [];
    $params = [];

    // Your existing filter conditions
    $filters = ['ProductCategory', 'ProductSubCategory', 'Collection'];
    foreach ($filters as $filter) {
        if (isset($_GET[$filter]) && !empty($_GET[$filter])) {
            $values = is_array($_GET[$filter]) ? $_GET[$filter] : [$_GET[$filter]];
            $placeholders = implode(',', array_fill(0, count($values), '?'));
            $conditions[] = "$filter IN ($placeholders)";
            $params = array_merge($params, $values);
        } elseif (isset($_GET["${filter}[]"])) {
            $values = $_GET["${filter}[]"];
            if (is_array($values)) {
                $placeholders = implode(',', array_fill(0, count($values), '?'));
                $conditions[] = "$filter IN ($placeholders)";
                $params = array_merge($params, $values);
            }
        }
    }

    // NEW CONDITIONS FOR RELATED PRODUCTS
    // Handle collection filter
    if (isset($_GET['collection']) && !empty($_GET['collection'])) {
        $conditions[] = "Collection = ?";
        $params[] = $_GET['collection'];
    }

    // Handle exclude collection filter
    if (isset($_GET['exclude_collection']) && !empty($_GET['exclude_collection'])) {
        $conditions[] = "Collection != ?";
        $params[] = $_GET['exclude_collection'];
    }

    // Handle category filter
    if (isset($_GET['category']) && !empty($_GET['category'])) {
        $conditions[] = "ProductCategory = ?";
        $params[] = $_GET['category'];
    }

    // Handle exclude category filter
    if (isset($_GET['exclude_category']) && !empty($_GET['exclude_category'])) {
        $conditions[] = "ProductCategory != ?";
        $params[] = $_GET['exclude_category'];
    }

    // Handle subcategory filter
    if (isset($_GET['subcategory']) && !empty($_GET['subcategory'])) {
        $conditions[] = "ProductSubCategory = ?";
        $params[] = $_GET['subcategory'];
    }

    // Handle exclude C-Variation filter
    if (isset($_GET['exclude_c_variation']) && !empty($_GET['exclude_c_variation'])) {
        $conditions[] = "`C-Variation` != ?";
        $params[] = $_GET['exclude_c_variation'];
    }

    // Handle exclude product filter
    if (isset($_GET['exclude_product']) && !empty($_GET['exclude_product'])) {
        $conditions[] = "Product_Code != ?";
        $params[] = $_GET['exclude_product'];
    }

    // Add 3D available condition
    if (isset($_GET['has_3d'])) {
        $conditions[] = "3DLink IS NOT NULL AND 3DLink != ''";
    }

    if (!empty($conditions)) {
        $query .= " AND " . implode(' AND ', $conditions);
    }

    $query .= " LIMIT ? OFFSET ?";

    try {
        $stmt = $dbh->prepare($query);

        // Bind parameters
        foreach ($params as $key => $value) {
            $stmt->bindValue($key + 1, $value);
        }

        // Bind LIMIT and OFFSET separately
        $stmt->bindValue(count($params) + 1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(count($params) + 2, $offset, PDO::PARAM_INT);

        $stmt->execute();
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($products);
    } catch (PDOException $e) {
        echo json_encode(["error" => "Database error: " . $e->getMessage()]);
    }
    exit;
}


  // If no valid request, return an error
  echo json_encode(["error" => "Invalid request"]);
} catch (PDOException $e) {
  echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
