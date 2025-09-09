let parsedData = [];
let zip = null;
let stopFlag = false;
let errorLog = [];

function addToErrorLog(url, rowIndex, errorMessage, errorDetails) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = {
    timestamp,
    url,
    rowIndex: rowIndex + 1,
    errorMessage,
    errorDetails
  };
  
  errorLog.push(logEntry);
  updateLogViewer();
  
  // Show log section if there are errors and update button visibility
  if (errorLog.length === 1) {
    document.getElementById("logSection").style.display = "block";
    document.getElementById("showLogBtn").style.display = "none";
  }
}

function updateLogViewer() {
  const logViewer = document.getElementById("logViewer");
  logViewer.innerHTML = "";
  
  errorLog.forEach(entry => {
    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";
    logEntry.innerHTML = `
      <div class="log-timestamp">${entry.timestamp}</div>
      <div class="log-url">Row ${entry.rowIndex}: <span class="url-text">${entry.url}</span></div>
      <div class="log-error">${entry.errorMessage}</div>
      ${entry.errorDetails ? `<div class="log-details">${entry.errorDetails}</div>` : ''}
    `;
    logViewer.appendChild(logEntry);
  });
  
  logViewer.scrollTop = logViewer.scrollHeight;
}

function clearErrorLog() {
  errorLog = [];
  updateLogViewer();
  document.getElementById("logSection").style.display = "none";
  document.getElementById("showLogBtn").style.display = "none";
}

function resetApplication() {
  // Reset global state
  parsedData = [];
  zip = null;
  stopFlag = false;
  clearErrorLog();
  
  // Reset UI elements
  document.getElementById("csvFile").value = "";
  document.getElementById("urlColumn").innerHTML = "";
  document.getElementById("previewTable").innerHTML = "";
  document.getElementById("thumbs").innerHTML = "";
  document.getElementById("progress").textContent = "";
  
  // Reset button visibility
  document.getElementById("fileBar").style.display = "flex";
  document.getElementById("fetchBar").style.display = "none";
  document.getElementById("stopBtn").style.display = "none";
  document.getElementById("downloadZipBtn").style.display = "none";
  document.getElementById("startOverBtn").style.display = "none";
  document.getElementById("showLogBtn").style.display = "none";
  
  // Reset fetchBtn visibility
  document.getElementById("fetchBtn").style.display = "inline-block";
  document.getElementById("urlColumn").style.display = "inline-block";
}

function generateUniqueFilename(url, index, usedFilenames) {
  try {
    const urlObj = new URL(url);
    let filename = urlObj.pathname.split("/").pop() || `image_${index}`;
    
    // Remove query parameters if they exist
    filename = filename.split('?')[0];
    
    // Add extension if missing
    if (!filename.includes(".") || filename.endsWith(".")) {
      filename = filename.replace(/\.$/, '') + ".jpg";
    }
    
    // Ensure image filename uniqueness by adding suffix if needed
    let uniqueFilename = filename;
    let suffix = 1;
    while (usedFilenames.has(uniqueFilename)) {
      const lastDotIndex = filename.lastIndexOf('.');
      if (lastDotIndex > 0) {
        const name = filename.substring(0, lastDotIndex);
        const ext = filename.substring(lastDotIndex);
        uniqueFilename = `${name}_${suffix}${ext}`;
      } else {
        uniqueFilename = `${filename}_${suffix}`;
      }
      suffix++;
    }
    
    return uniqueFilename;
  } catch (e) {
    // If URL parsing fails, use fallback
    let fallback = `image_${index}.jpg`;
    let suffix = 1;
    while (usedFilenames.has(fallback)) {
      fallback = `image_${index}_${suffix}.jpg`;
      suffix++;
    }
    return fallback;
  }
}

async function createThumbnailFromBlob(blob, maxSize = 50) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      let scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

document.getElementById("csvFile").addEventListener("change", () => {
  const fileInput = document.getElementById("csvFile");
  if (!fileInput.files.length) return;

  Papa.parse(fileInput.files[0], {
    header: true,
    complete: function(results) {
      parsedData = results.data;
      const headers = results.meta.fields;

      // Fill column select
      const select = document.getElementById("urlColumn");
      select.innerHTML = "";
      headers.forEach(h => {
        const opt = document.createElement("option");
        opt.value = h;
        opt.textContent = h;
        select.appendChild(opt);
      });

      // Show preview table with first 20 rows
      renderPreview(headers, parsedData.slice(0, 20));

      document.getElementById("fetchBar").style.display = "flex";
    }
  });
});

function renderPreview(headers, rows) {
  const table = document.getElementById("previewTable");
  table.innerHTML = "";

  const allHeaders = [...headers, "filename", "imgdata", "_status"];

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const statusTh = document.createElement("th");
  statusTh.textContent = "✔";
  headRow.appendChild(statusTh);
  allHeaders.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    const statusTd = document.createElement("td");
    statusTd.classList.add("status");
    statusTd.textContent = "";
    tr.appendChild(statusTd);
    allHeaders.forEach(h => {
      const td = document.createElement("td");
      if (h === "imgdata" && row[h]) {
        // Show thumbnail if available
        const img = document.createElement("img");
        img.src = row[h];
        img.style.maxWidth = "30px";
        img.style.maxHeight = "30px";
        td.appendChild(img);
      } else {
        td.textContent = row[h] || "";
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

document.getElementById("fetchBtn").addEventListener("click", async () => {
  const urlCol = document.getElementById("urlColumn").value;
  const progressDiv = document.getElementById("progress");
  const table = document.getElementById("previewTable");
  const tbody = table.querySelector("tbody");
  const thumbsDiv = document.getElementById("thumbs");

  zip = new JSZip();
  const imgFolder = zip.folder("images");
  stopFlag = false;

  // Clear previous error log and hide log section
  clearErrorLog();
  
  // Init new columns to ensure they're always present in CSV
  const usedFilenames = new Set();
  parsedData.forEach((row, index) => {
    row.filename = "";
    row.imgdata = "";
    row._status = "";
  });

  document.getElementById("fileBar").style.display = "none";
  document.getElementById("urlColumn").style.display = "none";
  document.getElementById("fetchBtn").style.display = "none";
  document.getElementById("stopBtn").style.display = "inline-block";

  let total = parsedData.length;
  let count = 0;

  for (let i = 0; i < parsedData.length; i++) {
    if (stopFlag) break;
    const row = parsedData[i];
    
    if (row[urlCol]) {
      try {
        const response = await fetch(row[urlCol]);
        if (!response.ok) throw new Error(`Failed to fetch ${row[urlCol]}`);
        const blob = await response.blob();

        const filename = generateUniqueFilename(row[urlCol], i, usedFilenames);
        usedFilenames.add(filename);
        
        row.filename = filename;
        row.imgdata = await createThumbnailFromBlob(blob);
        imgFolder.file(filename, blob);
        row._status = "✓";

        // Update thumbs display (keep last 10)
        const thumbImg = document.createElement("img");
        thumbImg.src = row.imgdata;
        thumbsDiv.appendChild(thumbImg);
        if (thumbsDiv.children.length > 10) {
          thumbsDiv.removeChild(thumbsDiv.firstChild);
        }
        
        count++;
      } catch (e) {
        console.error("Error processing:", row[urlCol], e);
        
        // Simplified error handling with raw error details
        const rawError = `${e.name}: ${e.message}`;
        let errorMessage = "Failed to fetch image";
        let errorDetails = `Raw Error: ${rawError}`;
        
        if (e.name === "TypeError") {
          errorMessage = "Network or CORS Error";
          errorDetails = `Cannot access this URL from the browser. This could be due to CORS policy, network issues, or server problems.\n\nRaw Error: ${rawError}`;
        } else if (e.message.includes("404")) {
          errorMessage = "Image Not Found (404)";
        } else if (e.message.includes("403")) {
          errorMessage = "Access Forbidden (403)";
        } else if (e.message.includes("500")) {
          errorMessage = "Server Error (500)";
        } else {
          errorMessage = e.message || "Unknown error";
        }
        
        addToErrorLog(row[urlCol], i, errorMessage, errorDetails);
        
        row._status = "✗";
        count++;
      }
    } else {
      count++;
    }

    progressDiv.textContent = `Processed ${count} of ${total}`;

    // Update table preview live (first 20 rows only)
    if (i < 20) {
      const tr = tbody.children[i];
      if (tr) {
        const statusTd = tr.firstChild;
        statusTd.textContent = row._status || "-";
        if (row._status === "✓") tr.classList.add("done");
        if (row._status === "✗") tr.classList.add("fail");
      }
    }
  }

  document.getElementById("stopBtn").style.display = "none";
  document.getElementById("downloadZipBtn").style.display = "inline-block";
  document.getElementById("startOverBtn").style.display = "inline-block";
});

document.getElementById("stopBtn").addEventListener("click", () => {
  stopFlag = true;
});

document.getElementById("downloadZipBtn").addEventListener("click", async () => {
  if (!zip) return alert("No ZIP archive created yet.");
  const csv = Papa.unparse(parsedData);
  zip.file("updated_images.csv", csv);
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "ImgNetMaker_output.zip");
});

// Log viewer controls
document.getElementById("clearLogBtn").addEventListener("click", () => {
  clearErrorLog();
});

document.getElementById("toggleLogBtn").addEventListener("click", () => {
  const logSection = document.getElementById("logSection");
  const toggleBtn = document.getElementById("toggleLogBtn");
  const showLogBtn = document.getElementById("showLogBtn");
  
  if (logSection.style.display === "none") {
    logSection.style.display = "block";
    toggleBtn.textContent = "Hide Log";
    showLogBtn.style.display = "none";
  } else {
    logSection.style.display = "none";
    toggleBtn.textContent = "Show Log";
    if (errorLog.length > 0) {
      showLogBtn.style.display = "inline-block";
    }
  }
});

// Show Error Log button
document.getElementById("showLogBtn").addEventListener("click", () => {
  const logSection = document.getElementById("logSection");
  const toggleBtn = document.getElementById("toggleLogBtn");
  const showLogBtn = document.getElementById("showLogBtn");
  
  logSection.style.display = "block";
  toggleBtn.textContent = "Hide Log";
  showLogBtn.style.display = "none";
});

// Start Over button
document.getElementById("startOverBtn").addEventListener("click", () => {
  resetApplication();
});