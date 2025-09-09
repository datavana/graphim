let parsedData = [];
let zip = null;
let stopFlag = false;

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

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const statusTh = document.createElement("th");
  statusTh.textContent = "✔";
  headRow.appendChild(statusTh);
  headers.forEach(h => {
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
    headers.forEach(h => {
      const td = document.createElement("td");
      td.textContent = row[h] || "";
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

        const urlObj = new URL(row[urlCol]);
        let filename = urlObj.pathname.split("/").pop() || `image_${i}`;
        if (!filename.includes(".")) {
          filename += ".jpg";
        }
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
      } catch (e) {
        console.error("Error processing:", row[urlCol], e);
        row._status = "✗";
      }
    } else {
      total--; // skip rows without URL
    }

    count++;
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
});

document.getElementById("stopBtn").addEventListener("click", () => {
  stopFlag = true;
});

document.getElementById("downloadZipBtn").addEventListener("click", async () => {
  if (!zip) return alert("No ZIP archive created yet.");
  const csv = Papa.unparse(parsedData);
  zip.file("updated_images.csv", csv);
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "images_and_csv.zip");
});