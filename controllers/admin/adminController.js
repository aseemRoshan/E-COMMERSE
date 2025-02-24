const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const generateExcelReport = async (req, res, next) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Add headers
        worksheet.columns = [
            { header: 'Order ID', key: 'orderID', width: 20 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Items', key: 'items', width: 10 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Final Amount', key: 'finalAmount', width: 15 },
            { header: 'Payment Method', key: 'paymentMethod', width: 20 },
        ];

        // Fetch orders from the database
        let { startDate, endDate } = req.query;

        // Validate and set default dates if not provided
        if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 1); // Default to 1 day range
            startDate = start.toISOString().split('T')[0];
            endDate = end.toISOString().split('T')[0];
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1); // Include the end date in the range

        // Fetch orders within the date range
        const orders = await Order.find({ createdOn: { $gte: start, $lt: end } })
            .select('orderId createdOn product totalPrice discount finalAmount payment')
            .sort({ createdOn: 1 });

        console.log('Retrieved Orders:', orders); // Debugging statement

        // Add data to the worksheet
        orders.forEach(order => {
            console.log('Order:', order); // Debugging statement
            const itemCount = Array.isArray(order.product) ? order.product.length : 0;
            const amount = order.totalPrice !== undefined ? `₹${order.totalPrice.toFixed(2)}` : '₹0.00';
            const discount = order.discount !== undefined ? `₹${order.discount.toFixed(2)}` : '₹0.00';
            const finalAmount = order.finalAmount !== undefined ? `₹${order.finalAmount.toFixed(2)}` : '₹0.00';
            const paymentMethod = order.payment || 'N/A';

            console.log('Payment Method:', paymentMethod); // Debugging statement

            worksheet.addRow({
                orderID: order.orderId,
                date: order.createdOn.toLocaleDateString(),
                items: itemCount,
                amount: amount,
                discount: discount,
                finalAmount: finalAmount,
                paymentMethod: paymentMethod,
            });
        });

        // Add summary
        worksheet.addRow([]); // Empty row for spacing
        worksheet.addRow({ orderID: 'Summary' });

        // Merge cells for summary headers
        const summaryRow = orders.length + 3;
        worksheet.mergeCells(`A${summaryRow}:G${summaryRow}`);
        worksheet.getCell(`A${summaryRow}`).value = 'Summary';
        worksheet.getCell(`A${summaryRow}`).alignment = { horizontal: 'center' };

        worksheet.mergeCells(`A${summaryRow + 1}:B${summaryRow + 1}`);
        worksheet.getCell(`A${summaryRow + 1}`).value = 'Total Orders';
        worksheet.getCell(`C${summaryRow + 1}`).value = orders.length;

        worksheet.mergeCells(`A${summaryRow + 2}:B${summaryRow + 2}`);
        worksheet.getCell(`A${summaryRow + 2}`).value = 'Total Amount';
        worksheet.getCell(`C${summaryRow + 2}`).value = `₹${orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0).toFixed(2)}`;

        worksheet.mergeCells(`A${summaryRow + 3}:B${summaryRow + 3}`);
        worksheet.getCell(`A${summaryRow + 3}`).value = 'Total Discount';
        worksheet.getCell(`C${summaryRow + 3}`).value = `₹${orders.reduce((sum, order) => sum + (order.discount || 0), 0).toFixed(2)}`;

        worksheet.mergeCells(`A${summaryRow + 4}:B${summaryRow + 4}`);
        worksheet.getCell(`A${summaryRow + 4}`).value = 'Total Final Amount';
        worksheet.getCell(`C${summaryRow + 4}`).value = `₹${orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0).toFixed(2)}`;

        const filePath = path.join(__dirname, 'report.xlsx');
        await workbook.xlsx.writeFile(filePath);

        res.download(filePath, 'report.xlsx', (err) => {
            if (err) {
                console.log("Error downloading file", err);
            }
            fs.unlinkSync(filePath); // Remove the file after download
        });
    } catch (error) {
        console.log("Error generating Excel report", error);
        next(error);
    }
};

const generatePdfReport = async (req, res, next) => {
    try {
        const doc = new PDFDocument();
        const filePath = path.join(__dirname, 'report.pdf');
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // Define color palette
        const colors = {
            primary: '#1C4E80',
            secondary: '#0091D5',
            accent: '#7AB800',
            background: '#F7F9FC',
            text: '#333333',
            tableHeader: '#E6EEF6'
        };

        // Fetch data from the database
        let { startDate, endDate } = req.query;

        // Validate and set default dates if not provided
        if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 1); // Default to 1 day range
            startDate = start.toISOString().split('T')[0];
            endDate = end.toISOString().split('T')[0];
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1); // Include the end date in the range

        // Fetch orders within the date range
        const orders = await Order.find({ createdOn: { $gte: start, $lt: end } })
            .select('orderId createdOn product totalPrice discount finalAmount payment')
            .sort({ createdOn: 1 });

        // Set page background
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.background);

        // Add a styled title with border
        doc.roundedRect(50, 40, doc.page.width - 100, 60, 5).fill(colors.primary);
        doc.fontSize(24).fillColor('white').text('Sales Report', 50, 60, { align: 'center' });

        // Add period with better styling
        doc.fontSize(14).fillColor(colors.secondary)
            .text(`Period: ${startDate} to ${endDate}`, 50, 120, { align: 'center' });
        doc.moveDown();

        // Add order details section
        doc.fontSize(16).fillColor(colors.primary).text('Order Details', 50, 160, { underline: false });
        doc.moveDown();

        // Calculate appropriate table width to fit within the page margins
        const pageWidth = doc.page.width;
        const margin = 50;
        const tableWidth = pageWidth - (margin * 2);

        // Adjust column widths proportionally to fit the table width
        // Define table headers
        const headers = ['Order ID', 'Date', 'Items', 'Amount', 'Discount', 'Final Amt', 'Payment'];
        // Calculate proportions for columns
        const totalParts = 550; // Total of the original column widths (120+70+60+70+70+70+90)
        const columnWidths = [
            Math.floor((120 / totalParts) * tableWidth),
            Math.floor((70 / totalParts) * tableWidth),
            Math.floor((60 / totalParts) * tableWidth),
            Math.floor((70 / totalParts) * tableWidth),
            Math.floor((70 / totalParts) * tableWidth),
            Math.floor((70 / totalParts) * tableWidth),
            Math.floor((90 / totalParts) * tableWidth)
        ];

        // Ensure widths sum exactly to tableWidth
        const widthSum = columnWidths.reduce((a, b) => a + b, 0);
        if (widthSum < tableWidth) {
            columnWidths[0] += tableWidth - widthSum; // Add any remainder to first column
        }

        let x = margin; // Starting x position
        let y = doc.y; // Starting y position

        // Draw table headers with background
        doc.fontSize(11).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.rect(x, y - 20, columnWidths[i], 20).fillAndStroke(colors.tableHeader, colors.primary);
            const textHeight = doc.heightOfString(header, { width: columnWidths[i] });
            const verticalCenter = y + (20 - textHeight) / 2 - 20;
            doc.fillColor(colors.primary).text(header, x, verticalCenter, { width: columnWidths[i], align: 'center' });
            x += columnWidths[i];
        });
        y += 20; // Move y position down for the next row
        x = margin; // Reset x position

        // Draw table rows with dynamic data
        doc.fontSize(8).font('Courier');
        orders.forEach((order, index) => {
            // Set alternating row backgrounds
            const rowColor = index % 2 === 0 ? 'white' : '#F5F7FA';
            doc.rect(margin, y, tableWidth, 20).fill(rowColor);

            const itemCount = Array.isArray(order.product) ? order.product.length : 0;
            const amount = order.totalPrice !== undefined ? `₹${order.totalPrice.toFixed(2)}` : '₹0.00';
            const discount = order.discount !== undefined ? `₹${order.discount.toFixed(2)}` : '₹0.00';
            const finalAmount = order.finalAmount !== undefined ? `₹${order.finalAmount.toFixed(2)}` : '₹0.00';
            const paymentMethod = order.payment || 'N/A';
            const finalAmountColor = order.finalAmount > 0 ? colors.accent : colors.text;

            // Check if the current row exceeds the page height
            if (y + 20 > doc.page.height - 50) {
                doc.addPage();

                // Set background for new page
                doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.background);

                y = 50; // Reset y position for the new page
                x = margin; // Reset x position

                // Redraw table headers on the new page
                doc.fontSize(11).font('Helvetica-Bold');
                headers.forEach((header, i) => {
                    doc.rect(x, y - 20, columnWidths[i], 20).fillAndStroke(colors.tableHeader, colors.primary);
                    const textHeight = doc.heightOfString(header, { width: columnWidths[i] });
                    const verticalCenter = y + (20 - textHeight) / 2 - 20;
                    doc.fillColor(colors.primary).text(header, x, verticalCenter, { width: columnWidths[i], align: 'center' });
                    x += columnWidths[i];
                });
                y += 20; // Move y position down for the next row
                x = margin; // Reset x position
            }

            // Draw table rows with wrapping text
            doc.fillColor(colors.text);
            doc.rect(x, y, columnWidths[0], 20).stroke();
            doc.text(order.orderId, x + 5, y + 5, { width: columnWidths[0] - 10, align: 'left' });
            x += columnWidths[0];

            doc.rect(x, y, columnWidths[1], 20).stroke();
            doc.text(order.createdOn.toLocaleDateString(), x + 5, y + 5, { width: columnWidths[1] - 10, align: 'left' });
            x += columnWidths[1];

            doc.rect(x, y, columnWidths[2], 20).stroke();
            doc.text(itemCount.toString(), x + 5, y + 5, { width: columnWidths[2] - 10, align: 'left' });
            x += columnWidths[2];

            doc.rect(x, y, columnWidths[3], 20).stroke();
            doc.text(amount, x + 5, y + 5, { width: columnWidths[3] - 10, align: 'left' });
            x += columnWidths[3];

            doc.rect(x, y, columnWidths[4], 20).stroke();
            doc.text(discount, x + 5, y + 5, { width: columnWidths[4] - 10, align: 'left' });
            x += columnWidths[4];

            doc.rect(x, y, columnWidths[5], 20).stroke();
            doc.fillColor(finalAmountColor).text(finalAmount, x + 5, y + 5, { width: columnWidths[5] - 10, align: 'left' });
            x += columnWidths[5];

            doc.fillColor(colors.text);
            doc.rect(x, y, columnWidths[6], 20).stroke();
            doc.text(paymentMethod, x + 5, y + 5, { width: columnWidths[6] - 10, align: 'left' });
            x = margin; // Reset x position
            y += 20; // Move y position down for the next row
        });

        // Add a page break if we're close to the bottom
        if (y > doc.page.height - 150) {
            doc.addPage();
            // Set background for new page
            doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.background);
            y = 50; // Reset y position for the new page
        } else {
            doc.moveDown(3); // Add more space after the table
            y = doc.y;
        }

        // Add summary section with a styled box
        doc.roundedRect(50, y, doc.page.width - 100, 120, 5).fillAndStroke('#F0F4F8', colors.secondary);
        doc.fontSize(18).fillColor(colors.primary).text('Summary', 60, y + 10, { underline: false });
        doc.moveDown(1);

        // Calculate summary values
        const totalOrders = orders.length;
        const totalAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0).toFixed(2);
        const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0).toFixed(2);
        const totalFinalAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0).toFixed(2);

        // Add summary content with styled values
        doc.fontSize(12).fillColor(colors.text);
        doc.text(`Total Orders: ${totalOrders}`, 60, doc.y + 10);
        doc.text(`Total Amount: ₹${totalAmount}`, 60, doc.y + 5);
        doc.text(`Total Discount: ₹${totalDiscount}`, 60, doc.y + 5);
        doc.fillColor(colors.accent).text(`Total Final Amount: ₹${totalFinalAmount}`, 60, doc.y + 5);

        // Add a footer with page numbers
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);

            // Add a subtle border around the page
            doc.lineWidth(0.5);
            doc.rect(15, 15, doc.page.width - 30, doc.page.height - 30).stroke(colors.secondary);

            // Add page numbers
            doc.fontSize(8).fillColor(colors.secondary)
                .text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 30, {
                    align: 'center',
                    width: doc.page.width - 100
                });
        }

        // Finalize the PDF
        doc.end();

        // Send the PDF as a download
        writeStream.on('finish', () => {
            res.download(filePath, 'report.pdf', (err) => {
                if (err) {
                    console.log("Error downloading file", err);
                }
                fs.unlinkSync(filePath); // Remove the file after download
            });
        });
    } catch (error) {
        console.log("Error generating PDF report", error);
        next(error);
    }
};

const pageError = async (req, res, next) => {
    try {
        res.render("admin-error");
    } catch (error) {
        next(error);
    }
};

const loadLogin = (req, res, next) => {
    try {
        if (req.session.admin) {
            return res.redirect("/admin/dashboard");
        }
        res.render("admin-login", { message: null });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            const passwordMatch = bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = admin;
                return res.redirect("/admin");
            } else {
                return res.redirect("/login");
            }
        } else {
            return res.redirect("/login");
        }
    } catch (error) {
        console.log("login error", error);
        next(error);
    }
};

const loadDashboard = async (req, res, next) => {
    if (req.session.admin) {
        try {
            let { startDate, endDate } = req.query;

            // Validate and set default dates if not provided
            if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 1); // Default to 1 day range
                startDate = start.toISOString().split('T')[0];
                endDate = end.toISOString().split('T')[0];
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1); // Include the end date in the range

            const totalSales = await Order.aggregate([
                { $match: { createdOn: { $gte: start, $lt: end } } },
                { $group: { _id: null, total: { $sum: "$finalAmount" } } }
            ]);

            const totalOrders = await Order.countDocuments({ createdOn: { $gte: start, $lt: end } });
            const returnedOrders = await Order.countDocuments({ status: "Returned", createdOn: { $gte: start, $lt: end } });
            const pendingOrders = await Order.countDocuments({ status: "Pending", createdOn: { $gte: start, $lt: end } });
            const deliveredOrders = await Order.countDocuments({ status: "Delivered", createdOn: { $gte: start, $lt: end } });
            const shippedOrders = await Order.countDocuments({ status: "Shipped", createdOn: { $gte: start, $lt: end } });
            const processingOrders = await Order.countDocuments({ status: "Processing", createdOn: { $gte: start, $lt: end } });
            const totalUsers = await User.countDocuments({ createdOn: { $gte: start, $lt: end } });
            const totalDiscount = await Order.aggregate([
                { $match: { createdOn: { $gte: start, $lt: end } } },
                { $group: { _id: null, total: { $sum: "$discount" } } }
            ]);

            res.render("dashboard", {
                totalSales: totalSales[0]?.total || 0,
                totalOrders,
                returnedOrders,
                pendingOrders,
                deliveredOrders,
                shippedOrders,
                processingOrders,
                totalUsers,
                totalDiscount: totalDiscount[0]?.total || 0,
                startDate,
                endDate,
            });
        } catch (error) {
            console.log("Dashboard error", error);
            next(error);
        }
    } else {
        res.redirect("/admin/login");
    }
};

const logout = async (req, res, next) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session", err);
                return next(err);
            }
            res.redirect("/admin/login");
        });
    } catch (error) {
        console.log("Unexpected error during logout", error);
        next(error);
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    generateExcelReport,
    generatePdfReport,
};
