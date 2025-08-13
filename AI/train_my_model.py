# train_my_model.py
import torch
from transformers import ViTForImageClassification, TrainingArguments, Trainer, ViTImageProcessor
from datasets import load_dataset


def main():
    """
    This script will download a base model from Google, fine-tune it on the
    PlantVillage dataset, and save the resulting expert model locally.
    """
    # 1. Define Model and Dataset Names
    # --- This is the stable "engine" from Google ---
    base_model_name = 'google/vit-base-patch16-224'
    # --- This is the official, stable dataset ---
    dataset_name = 'kerem/plant-village'
    # --- This is where your new model will be saved ---
    output_model_dir = './my_plant_disease_model'

    print(
        f"Starting process. Base Model: {base_model_name}, Dataset: {dataset_name}")

    # 2. Load the Dataset
    print("Loading dataset...")
    # The 'split' command downloads the training set and automatically splits it.
    # 90% for training, 10% for validation.
    train_ds, eval_ds = load_dataset(
        dataset_name, split=['train[:90%]', 'train[90%:]'])

    # Get the class labels from the dataset
    labels = train_ds.features['label'].names
    num_labels = len(labels)
    print(f"Dataset loaded. Number of classes: {num_labels}")
    print("Example labels:", labels[:5])

    # 3. Load the Processor and Model
    print("Loading image processor and base model...")
    # The processor prepares images for the model
    processor = ViTImageProcessor.from_pretrained(base_model_name)

    # We load the base model and tell it our number of classes.
    # `ignore_mismatched_sizes=True` is crucial for transfer learning.
    model = ViTForImageClassification.from_pretrained(
        base_model_name,
        num_labels=num_labels,
        id2label={str(i): c for i, c in enumerate(labels)},
        label2id={c: str(i) for i, c in enumerate(labels)},
        ignore_mismatched_sizes=True
    )
    print("Base model loaded.")

    # 4. Define Image Transformations
    def transform(example_batch):
        # Take a list of PIL images and turn them to pixel values
        inputs = processor([x.convert('RGB')
                           for x in example_batch['image']], return_tensors='pt')
        # Don't forget to include the labels!
        inputs['labels'] = example_batch['label']
        return inputs

    # Apply the transformations
    train_dataset = train_ds.with_transform(transform)
    eval_dataset = eval_ds.with_transform(transform)

    def collate_fn(batch):
        # This function handles creating batches of data
        return {
            'pixel_values': torch.stack([x['pixel_values'] for x in batch]),
            'labels': torch.tensor([x['labels'] for x in batch])
        }

    # 5. Define Training Arguments
    print("Configuring training...")
    training_args = TrainingArguments(
        output_dir=output_model_dir,
        per_device_train_batch_size=16,
        evaluation_strategy="steps",
        num_train_epochs=3,  # 3 epochs is a good starting point
        fp16=True,  # Use mixed precision for faster training if you have a capable GPU
        save_steps=500,
        eval_steps=500,
        logging_steps=100,
        learning_rate=2e-5,  # A good learning rate for fine-tuning
        save_total_limit=2,
        remove_unused_columns=False,
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        push_to_hub=False,
    )

    # 6. Initialize and Run the Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        data_collator=collate_fn,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
    )

    print("--- Starting Training ---")
    trainer.train()
    print("--- Training Complete ---")

    print(f"Saving the best model to {output_model_dir}")
    trainer.save_model(output_model_dir)
    print("Model saved successfully. You can now use this path in your Flask API.")


if __name__ == "__main__":
    main()
