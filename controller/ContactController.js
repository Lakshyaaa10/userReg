const Contact = require('../models/ContactModel');
const Helper = require('../Helper/Helper');

exports.sendMessage = async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return Helper.response("Failed", "Please provide all required fields", {}, res, 400);
        }

        const newMessage = new Contact({
            name,
            email,
            message
        });

        await newMessage.save();

        Helper.response("Success", "Message sent successfully", { message: newMessage }, res, 201);

    } catch (error) {
        console.error('Send message error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

exports.getMessages = async (req, res) => {
    try {
        const messages = await Contact.find().sort({ createdAt: -1 });
        Helper.response("Success", "Messages fetched successfully", { messages }, res, 200);
    } catch (error) {
        console.error('Get messages error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};
